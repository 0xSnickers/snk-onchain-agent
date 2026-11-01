import { Injectable } from "@nestjs/common";
import { Prisma, type SniperTarget as Row } from "@prisma/client";
import type { SniperControls, SniperIntent, SniperPreview } from "../../../../packages/contracts/src/sniper";
import { PrismaService } from "../../prisma/prisma.service";
import { DEFAULT_CONTROLS, usdMicros, type SniperObservation, type SniperReason, type SniperStatus } from "./sniper-policy";
import type { FeedWrite, StoredTarget } from "./sniper-feed";

const REASONS = new Set<SniperReason>([
  "READY",
  "FREE_NOTIFY_ONLY",
  "ALREADY_POOLED",
  "TOO_OLD",
  "SOLD_OUT",
  "NOT_AGENT_ID",
  "IDENTITY_UNVERIFIED",
  "FEE_UNKNOWN",
  "DRAINED",
  "DRAINED_UNKNOWN",
  "NO_CAP",
  "CAP_UNKNOWN",
  "PROGRESS_UNKNOWN",
  "BELOW_PROGRESS",
  "AGENT_WALLETS_UNKNOWN",
  "BELOW_WALLETS",
]);

@Injectable()
export class SniperRepository {
  constructor(private readonly db: PrismaService) {}

  async control(): Promise<SniperControls> {
    const row = await this.db.sniperControl.upsert({
      where: { id: "default" },
      create: { id: "default", ...DEFAULT_CONTROLS },
      update: {},
    });
    return controlsOf(row);
  }

  async writeControl(controls: SniperControls): Promise<SniperControls> {
    const row = await this.db.sniperControl.upsert({
      where: { id: "default" },
      create: { id: "default", ...controls },
      update: controls,
    });
    return controlsOf(row);
  }

  async list(): Promise<StoredTarget[]> {
    const rows = await this.db.sniperTarget.findMany({
      orderBy: { updatedAt: "desc" },
      take: 300,
    });
    return rows.map((row) => this.map(row));
  }

  async find(id: string) {
    const row = await this.db.sniperTarget.findUnique({ where: { id } });
    return row ? this.map(row) : null;
  }

  async findByAddress(contractAddress: string) {
    const row = await this.db.sniperTarget.findUnique({
      where: { chainId_contractAddress: { chainId: "56", contractAddress } },
    });
    return row ? this.map(row) : null;
  }

  async upsertAll(writes: FeedWrite[]) {
    if (!writes.length) return;
    await this.db.$transaction(async (tx) => {
      for (const write of writes) await this.upsert(tx, write);
    });
  }

  async armThreshold(id: string): Promise<StoredTarget | "disarmed" | "blocked"> {
    return this.db.$transaction(async (tx) => {
      const control = await tx.sniperControl.findUnique({ where: { id: "default" } });
      if (!control?.armed) return "disarmed";
      const changed = await tx.sniperTarget.updateMany({
        where: { id, status: "THRESHOLD" },
        data: { status: "ARMED", armedAt: new Date(), previewJson: Prisma.DbNull },
      });
      if (changed.count !== 1) return "blocked";
      const row = await tx.sniperTarget.findUnique({ where: { id } });
      return row ? this.map(row) : "blocked";
    });
  }

  async compare(
    id: string,
    from: SniperStatus[],
    patch: { status: SniperStatus; preview: SniperPreview | null },
  ) {
    return this.db.$transaction(async (tx) => {
      const changed = await tx.sniperTarget.updateMany({
        where: { id, status: { in: from } },
        data: { status: patch.status, previewJson: previewJson(patch.preview) },
      });
      if (changed.count !== 1) return null;
      const row = await tx.sniperTarget.findUnique({ where: { id } });
      return row ? this.map(row) : null;
    });
  }

  async consume(
    id: string,
    input: { amount: string; confirmationText: string },
  ): Promise<SniperIntent | null> {
    return this.db.$transaction(async (tx) => {
      const changed = await tx.sniperTarget.updateMany({
        where: { id, status: "AWAITING_CONFIRM" },
        data: { status: "CONFIRMED", previewJson: Prisma.DbNull },
      });
      if (changed.count !== 1) return null;
      const row = await tx.sniperIntent.create({
        data: {
          targetId: id,
          amount: input.amount,
          asset: "USDT",
          confirmationText: input.confirmationText,
          status: "RECORDED",
          broadcast: false,
        },
      });
      return {
        id: row.id,
        targetId: row.targetId,
        amount: row.amount,
        asset: "USDT",
        confirmationText: row.confirmationText,
        status: "RECORDED",
        broadcast: false,
        reason: "WALLET_DELEGATED",
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  async spentMicros(since: Date) {
    const rows = await this.db.sniperIntent.findMany({
      where: { createdAt: { gte: since }, status: "RECORDED", asset: "USDT" },
      select: { amount: true },
    });
    return rows.reduce((sum, row) => sum + usdMicros(row.amount), 0n);
  }

  private async upsert(tx: Prisma.TransactionClient, write: FeedWrite) {
    const armed = write.status === "ARMED" || write.status === "AWAITING_CONFIRM" || write.status === "CONFIRMED";
    const data = {
      symbol: write.symbol,
      name: write.name,
      source: write.source,
      stage: write.stage,
      kind: write.kind,
      status: write.status,
      progress: write.progress,
      holders: write.holders,
      agentWallets: write.agentWallets,
      reasons: write.reasons,
      evidenceJson: write.evidence as unknown as Prisma.InputJsonValue,
      imageUrl: write.imageUrl,
      platform: write.platform,
      url: write.url,
      previewJson: previewJson(write.preview),
      ...(armed ? {} : { armedAt: null }),
    };
    await tx.sniperTarget.upsert({
      where: { chainId_contractAddress: { chainId: "56", contractAddress: write.contractAddress } },
      create: { chainId: "56", contractAddress: write.contractAddress, ...data, armedAt: null },
      update: data,
    });
  }

  private map(row: Row): StoredTarget {
    const evidence = readEvidence(row);
    const preview = row.status === "AWAITING_CONFIRM" ? readPreview(row.previewJson) : null;
    return {
      id: row.id,
      chainId: "56",
      contractAddress: row.contractAddress,
      symbol: row.symbol,
      name: row.name,
      source: row.source === "MANUAL" ? "MANUAL" : "FOUR_EXCLUSIVE",
      stage: evidence.stage,
      kind: row.kind === "FREE" || row.kind === "PAID" ? row.kind : "UNKNOWN",
      status: isStatus(row.status) ? row.status : "WATCHING",
      progress: evidence.progress,
      holders: row.holders,
      agentWallets: evidence.agentWallets,
      reasons: row.reasons.filter(isReason),
      imageUrl: row.imageUrl,
      platform: row.platform,
      url: row.url,
      armedAt: row.armedAt?.toISOString() ?? null,
      preview,
      discoveredAt: row.discoveredAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      evidence,
    };
  }
}

function previewJson(preview: SniperPreview | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!preview) return Prisma.DbNull;
  return { amount: preview.amount, asset: preview.asset, expiresAt: preview.expiresAt };
}

function controlsOf(row: {
  armed: boolean;
  minProgress: number;
  minAgentWallets: number;
  maxUsd: number;
  dailyUsdCap: number;
}): SniperControls {
  return {
    armed: row.armed,
    minProgress: row.minProgress,
    minAgentWallets: row.minAgentWallets,
    maxUsd: row.maxUsd,
    dailyUsdCap: row.dailyUsdCap,
  };
}

function readEvidence(row: Row): SniperObservation {
  const value = row.evidenceJson;
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const record = raw as Record<string, unknown>;
  const evidence: SniperObservation = {
    exclusiveTemplate: record.exclusiveTemplate === true,
    bytecodeHasRegistry: bool(record.bytecodeHasRegistry),
    stage: stage(record.stage) === "UNKNOWN" ? stage(row.stage) : stage(record.stage),
    progress: num(record.progress) ?? (row.progress != null && Number.isFinite(row.progress) ? row.progress : null),
    agentWallets: integer(record.agentWallets) ?? row.agentWallets,
    feeWei: typeof record.feeWei === "string" && /^\d+$/.test(record.feeWei) ? record.feeWei : null,
    hasWalletCap: bool(record.hasWalletCap),
    hasTxCap: bool(record.hasTxCap),
    drained: bool(record.drained),
    pooled: bool(record.pooled),
    ageMs: integer(record.ageMs),
  };
  return evidence;
}

function readPreview(value: Prisma.JsonValue | null): SniperPreview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.amount !== "string" || raw.asset !== "USDT" || typeof raw.expiresAt !== "string") return null;
  return { amount: raw.amount, asset: "USDT", expiresAt: raw.expiresAt };
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}
function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function integer(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}
function stage(value: unknown): SniperObservation["stage"] {
  return value === "NEW" || value === "FINALIZING" || value === "MIGRATED" ? value : "UNKNOWN";
}
function isReason(value: string): value is SniperReason {
  return REASONS.has(value as SniperReason);
}
function isStatus(value: string): value is SniperStatus {
  return (
    value === "WATCHING" ||
    value === "NOTIFY_ONLY" ||
    value === "THRESHOLD" ||
    value === "ARMED" ||
    value === "AWAITING_CONFIRM" ||
    value === "CONFIRMED" ||
    value === "SKIPPED"
  );
}
