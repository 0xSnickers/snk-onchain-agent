import { Injectable } from "@nestjs/common";
import type { AgentLaunchToken, LaunchStage } from "../../../../packages/contracts/src/launch";
import type { SniperBoard, SniperControls, SniperIntent, SniperSourceHealth } from "../../../../packages/contracts/src/sniper";
import { AppError } from "../../common/http";
import { LaunchHttpProvider } from "../market/launch-http.provider";
import { planFeed, present, projectTarget, reclassify, type StoredTarget } from "./sniper-feed";
import {
  AGENT_ID_REGISTRY,
  assertControls,
  assertSpend,
  confirmPhrase,
  shanghaiDayStart,
  type SniperObservation,
} from "./sniper-policy";
import { SniperRepository } from "./sniper.repository";
import { SniperRpc } from "./sniper-rpc";

const WATCH: LaunchStage[] = ["NEW", "FINALIZING", "MIGRATED"];

@Injectable()
export class SniperService {
  private cacheAt = 0;
  private fetchedAt = new Date(0).toISOString();
  private sources: SniperSourceHealth[] = [];
  private refreshError: SniperBoard["refreshError"] = null;
  private inflight?: Promise<void>;

  constructor(
    private readonly repo: SniperRepository,
    private readonly launches: LaunchHttpProvider,
    private readonly rpc: SniperRpc,
  ) {}

  async board(): Promise<SniperBoard> {
    try {
      await this.refresh();
      this.refreshError = null;
    } catch (error) {
      const known = await this.repo.list();
      if (!known.length) throw error;
      this.refreshError = publicError(error);
    }
    return this.snapshot(await this.repo.control(), await this.repo.list());
  }

  async updateControls(input: SniperControls) {
    const controls = assertControls(input);
    await this.repo.writeControl(controls);
    await this.repo.upsertAll(reclassify(await this.repo.list(), controls));
    this.cacheAt = 0;
    return this.board();
  }

  async add(contractAddress: string) {
    const address = contractAddress.toLowerCase();
    const existing = await this.repo.findByAddress(address);
    if (existing) return present(existing);
    const bytecodeHasRegistry = await this.rpc.registryPresent(address);
    const observation: SniperObservation = {
      exclusiveTemplate: false,
      bytecodeHasRegistry,
      stage: "UNKNOWN",
      progress: null,
      agentWallets: null,
      feeWei: null,
      hasWalletCap: null,
      hasTxCap: null,
      drained: null,
      pooled: null,
      ageMs: null,
    };
    const controls = await this.repo.control();
    await this.repo.upsertAll([
      projectTarget(null, observation, {
        contractAddress: address,
        source: "MANUAL",
        symbol: "",
        name: "",
        holders: null,
        imageUrl: null,
        platform: "Manual",
        url: `https://bscscan.com/token/${address}`,
      }, controls),
    ]);
    const saved = await this.repo.findByAddress(address);
    if (!saved) throw new AppError("REQUEST_FAILED", "Sniper target was not stored", 500);
    return present(saved);
  }

  async arm(id: string) {
    if (!(await this.repo.find(id))) throw missing();
    const armed = await this.repo.armThreshold(id);
    if (armed === "disarmed") {
      throw new AppError("SNIPER_DISARMED", "Arm the sniper before arming a target", 409);
    }
    if (armed === "blocked") {
      throw new AppError("SNIPER_NOT_READY", "Target is not at the entry threshold", 409);
    }
    return present(armed);
  }

  async disarm(id: string) {
    const target = await this.repo.find(id);
    if (!target) throw missing();
    if (target.status !== "ARMED" && target.status !== "AWAITING_CONFIRM") return present(target);
    const next = await this.repo.compare(id, ["ARMED", "AWAITING_CONFIRM"], {
      status: "THRESHOLD",
      preview: null,
    });
    return present(next ?? target);
  }

  async preview(id: string, amount: string) {
    const controls = await this.requireArmed();
    await this.room(amount, controls);
    const target = await this.repo.find(id);
    if (!target) throw missing();
    if (target.status !== "ARMED") {
      throw new AppError("SNIPER_NOT_READY", "Arm this target before preview", 409);
    }
    const updated = await this.repo.compare(id, ["ARMED"], {
      status: "AWAITING_CONFIRM",
      preview: { amount, asset: "USDT", expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() },
    });
    if (!updated) throw new AppError("SNIPER_NOT_READY", "Arm this target before preview", 409);
    return present(updated);
  }

  async confirm(
    id: string,
    body: { amount: string; asset: string; confirmationText: string },
  ): Promise<SniperIntent> {
    if (body.asset !== "USDT") throw new AppError("VALIDATION_ERROR", "Sniper confirm is USDT only", 400);
    const controls = await this.requireArmed();
    const target = await this.repo.find(id);
    if (!target) throw missing();
    if (target.status === "CONFIRMED") {
      throw new AppError("CONFIRM_CONSUMED", "Confirmation was already used", 409);
    }
    if (target.status !== "AWAITING_CONFIRM" || !target.preview) {
      throw new AppError("CONFIRM_REQUIRED", "Preview and arm before confirming", 409);
    }
    if (Date.parse(target.preview.expiresAt) <= Date.now()) {
      await this.repo.compare(id, ["AWAITING_CONFIRM"], { status: "ARMED", preview: null });
      throw new AppError("PREVIEW_EXPIRED", "Preview expired", 409);
    }
    if (body.amount !== target.preview.amount || body.confirmationText !== confirmPhrase(body.amount)) {
      throw new AppError("CONFIRM_REQUIRED", "Confirmation text does not match", 409);
    }
    await this.room(body.amount, controls);
    const intent = await this.repo.consume(id, {
      amount: body.amount,
      confirmationText: body.confirmationText,
    });
    if (!intent) throw new AppError("CONFIRM_CONSUMED", "Confirmation was already used", 409);
    return intent;
  }

  private async refresh() {
    if (this.cacheAt && Date.now() - this.cacheAt < 30_000) return;
    if (!this.inflight) {
      this.inflight = this.load().finally(() => {
        this.inflight = undefined;
      });
    }
    await this.inflight;
  }

  private async load() {
    const settled = await Promise.all(WATCH.map((stage) => this.readStage(stage)));
    const failed = settled.filter((item) => item.stage !== "MIGRATED" && item.status === "ERROR");
    if (failed.length === 2) {
      throw new AppError("SNIPER_UPSTREAM_ERROR", "Agent ID exclusive feed is unavailable", 502);
    }
    const tokens = settled
      .filter((item) => item.stage !== "MIGRATED" && item.status === "OK")
      .flatMap((item) => item.tokens);
    const migrated = settled.find((item) => item.stage === "MIGRATED");
    const controls = await this.repo.control();
    const existing = await this.repo.list();
    await this.repo.upsertAll(
      planFeed(existing, tokens, migrated?.status === "OK" ? migrated.tokens.map((token) => token.address) : [], controls),
    );
    this.sources = settled.map(({ stage, status, tokens: rows, error }) => ({
      stage,
      status,
      count: rows.length,
      error,
    }));
    this.cacheAt = Date.now();
    this.fetchedAt = new Date(this.cacheAt).toISOString();
  }

  private async readStage(stage: LaunchStage): Promise<{
    stage: LaunchStage;
    status: "OK" | "ERROR";
    tokens: AgentLaunchToken[];
    error: { code: string; message: string } | null;
  }> {
    try {
      return { stage, status: "OK", tokens: await this.launches.four(stage), error: null };
    } catch (error) {
      return { stage, status: "ERROR", tokens: [], error: publicError(error) };
    }
  }

  private async requireArmed() {
    const controls = await this.repo.control();
    if (!controls.armed) throw new AppError("SNIPER_DISARMED", "Sniper is disarmed", 409);
    return controls;
  }

  private async room(amount: string, controls: SniperControls) {
    assertSpend(amount, controls.maxUsd, await this.repo.spentMicros(shanghaiDayStart()), controls.dailyUsdCap);
  }

  private snapshot(controls: SniperControls, targets: StoredTarget[]): SniperBoard {
    return {
      chain: "bsc",
      coverage: "BOUNDED_SAMPLE",
      broadcast: false,
      registry: AGENT_ID_REGISTRY,
      fetchedAt: this.fetchedAt,
      controls,
      targets: targets.map(present),
      sources: this.sources,
      refreshError: this.refreshError,
    };
  }
}

function missing() {
  return new AppError("TARGET_NOT_FOUND", "Sniper target was not found", 404);
}

function publicError(error: unknown) {
  if (error instanceof AppError) return { code: error.code, message: error.message };
  return { code: "SNIPER_UPSTREAM_ERROR", message: "Agent ID exclusive feed is unavailable" };
}
