import { agentEnv } from "../../config/agent-env";
import { DelegationRepository } from "./delegation.repository";
import { Injectable } from "@nestjs/common";
import { AgentStore } from "../agent-runs/agent.store";
import { DelegationService } from "./delegation.service";
import { FairMintProvider } from "./detection.provider";
import { DiscoveryService } from "../mint-monitor/discovery.service";
import { AgentLaunchService } from "../market/agent-launch.service";
import { AppError } from "../../common/http";
@Injectable()
export class DetectionService {
  constructor(
    private readonly store: AgentStore,
    private readonly queue: DelegationService,
    private readonly fair: FairMintProvider,
    private readonly meme: DiscoveryService,
    private readonly launches: AgentLaunchService,
    private readonly repo: DelegationRepository,
  ) {}
  async scan() {
    return this.store.withLease("detection", async () => {
      const run = await this.store.createRun("SCAN");
      let failures = 0;
      const step = async (name: string, fn: () => Promise<unknown>) => {
        try {
          await this.store.action(run.id, name, "INFO", await fn());
        } catch (e) {
          failures++;
          await this.store.action(run.id, name, "DENY", {
            code: e instanceof AppError ? e.code : "DETECTION_LOCAL_ERROR",
          });
        }
      };
      await step("external-fair-mint", async () => {
        const rows = await this.fair.discover();
        for (const c of rows)
          await this.store.addCandidate({ ...c, source: "external-fair-mint" });
        return { observed: rows.length };
      });
      if (process.env.MEME_DISCOVERY_ENABLED === "true")
        await step("meme-rush", () => this.meme.discover());
      if (process.env.AGENT_LAUNCH_DETECTION_ENABLED === "true")
        await step("agent-launch", async () => {
          const market = await this.launches.list();
          for (const s of market.sources)
            if (s.status === "ERROR") {
              failures++;
              await this.store.action(run.id, s.source, "DENY", s.error);
            }
          for (const t of market.tokens) {
            if (!t.tokenDeployed) continue;
            await this.store.addCandidate({
              chainId: "56",
              contractAddress: t.address,
              name: t.name,
              symbol: t.symbol,
              class: "PAID_TOKEN",
              source:
                t.source === "FLAP_AGENT"
                  ? "agent-launch-flap"
                  : t.source === "FOUR_AGENT"
                    ? "agent-launch-openfour"
                    : "agent-launch-gang",
            });
          }
          return { observed: market.tokens.length };
        });
      await this.repo.expire();
      const active = new Set(
        (await this.repo.activeCandidates()).map((r) => r.candidateId),
      );
      const pending = (await this.store.candidates())
        .filter(
          (c) =>
            !active.has(c.id) &&
            ["DISCOVERED", "FREE_ELIGIBLE", "PAID_RESEARCH"].includes(c.status),
        )
        .slice(0, agentEnv.batchSize);
      for (const c of pending) {
        if (
          !["DISCOVERED", "FREE_ELIGIBLE", "PAID_RESEARCH"].includes(c.status)
        )
          continue;
        await step(`classify.${c.id}`, async () => {
          const row = await this.queue.queue(c.id);
          return { candidateId: c.id, outboxId: row.id, kind: row.kind };
        });
      }
      await this.store.finish(
        run.id,
        failures ? "FAILED" : "SUCCEEDED",
        failures
          ? `Detection completed with ${failures} source/classification failures`
          : "Detection completed; candidates queued without wallet calls",
      );
      return {
        id: run.id,
        status: failures ? "FAILED" : "SUCCEEDED",
        failures,
      };
    });
  }
}
