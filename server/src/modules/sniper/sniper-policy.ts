import { AppError } from "../../common/http";
import type { SniperControls } from "../../../../packages/contracts/src/sniper";
export type { SniperControls };

export const AGENT_ID_REGISTRY = "0x60b9262456de011f7d15a54cdd8c48baaa8b022f";
export const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
export const PREVIEW_MS = 5 * 60 * 1000;

export const DEFAULT_CONTROLS: SniperControls = {
  armed: false,
  minProgress: 65,
  minAgentWallets: 115,
  maxUsd: 20,
  dailyUsdCap: 60,
};

export type SniperStatus =
  | "WATCHING"
  | "NOTIFY_ONLY"
  | "THRESHOLD"
  | "ARMED"
  | "AWAITING_CONFIRM"
  | "CONFIRMED"
  | "SKIPPED";

export type SniperReason =
  | "READY"
  | "FREE_NOTIFY_ONLY"
  | "ALREADY_POOLED"
  | "TOO_OLD"
  | "SOLD_OUT"
  | "NOT_AGENT_ID"
  | "IDENTITY_UNVERIFIED"
  | "FEE_UNKNOWN"
  | "DRAINED"
  | "DRAINED_UNKNOWN"
  | "NO_CAP"
  | "CAP_UNKNOWN"
  | "PROGRESS_UNKNOWN"
  | "BELOW_PROGRESS"
  | "AGENT_WALLETS_UNKNOWN"
  | "BELOW_WALLETS";

export interface SniperObservation {
  exclusiveTemplate: boolean;
  bytecodeHasRegistry: boolean | null;
  stage: "NEW" | "FINALIZING" | "MIGRATED" | "UNKNOWN";
  progress: number | null;
  agentWallets: number | null;
  feeWei: string | null;
  hasWalletCap: boolean | null;
  hasTxCap: boolean | null;
  drained: boolean | null;
  pooled: boolean | null;
  ageMs: number | null;
}

export interface Classified {
  kind: "FREE" | "PAID" | "UNKNOWN";
  status: "WATCHING" | "NOTIFY_ONLY" | "THRESHOLD" | "SKIPPED";
  reasons: SniperReason[];
}

const AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
const ACTIVE = new Set<SniperStatus>(["ARMED", "AWAITING_CONFIRM"]);

export function assertControls(input: SniperControls): SniperControls {
  const { armed, minProgress, minAgentWallets, maxUsd, dailyUsdCap } = input;
  const band = (value: number, min: number, max: number) =>
    Number.isInteger(value) && value >= min && value <= max;
  if (
    typeof armed !== "boolean" ||
    !band(minProgress, 60, 70) ||
    !band(minAgentWallets, 100, 130) ||
    !band(maxUsd, 1, 20) ||
    !band(dailyUsdCap, 1, 60) ||
    maxUsd > dailyUsdCap
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Sniper controls are outside the allowed bands",
      400,
    );
  }
  return { armed, minProgress, minAgentWallets, maxUsd, dailyUsdCap };
}

export function classify(
  obs: SniperObservation,
  controls: SniperControls,
): Classified {
  const kind = kindOf(obs);
  const progress = validProgress(obs.progress);
  if (obs.stage === "MIGRATED" || obs.pooled === true) {
    return skip(kind, "ALREADY_POOLED");
  }
  if (obs.ageMs != null && obs.ageMs > TWO_DAYS_MS) return skip(kind, "TOO_OLD");
  if (progress != null && progress >= 100) return skip(kind, "SOLD_OUT");
  const identified = obs.exclusiveTemplate || obs.bytecodeHasRegistry === true;
  if (!identified) {
    return obs.bytecodeHasRegistry === false
      ? { kind: "UNKNOWN", status: "SKIPPED", reasons: ["NOT_AGENT_ID"] }
      : { kind: "UNKNOWN", status: "WATCHING", reasons: ["IDENTITY_UNVERIFIED"] };
  }
  if (kind === "UNKNOWN") {
    return { kind, status: "WATCHING", reasons: ["FEE_UNKNOWN"] };
  }
  if (kind === "FREE") {
    return { kind, status: "NOTIFY_ONLY", reasons: ["FREE_NOTIFY_ONLY"] };
  }
  if (obs.drained === true) return skip(kind, "DRAINED");
  const reasons: SniperReason[] = [];
  const cap = capReason(obs);
  if (cap === "NO_CAP") return skip(kind, "NO_CAP");
  if (cap) reasons.push(cap);
  if (progress == null) reasons.push("PROGRESS_UNKNOWN");
  else if (progress < controls.minProgress) reasons.push("BELOW_PROGRESS");
  if (!knownCount(obs.agentWallets)) reasons.push("AGENT_WALLETS_UNKNOWN");
  else if (obs.agentWallets < controls.minAgentWallets) reasons.push("BELOW_WALLETS");
  if (obs.drained == null) reasons.push("DRAINED_UNKNOWN");
  if (reasons.length) return { kind, status: "WATCHING", reasons };
  return { kind, status: "THRESHOLD", reasons: ["READY"] };
}

export function nextStatus(
  previous: SniperStatus,
  classified: Classified,
  armed: boolean,
): SniperStatus {
  if (previous === "CONFIRMED") return "CONFIRMED";
  if (classified.status !== "THRESHOLD") return classified.status;
  if (armed && ACTIVE.has(previous)) return previous;
  return "THRESHOLD";
}

export function mergeObservation(
  prev: SniperObservation | undefined,
  next: SniperObservation,
): SniperObservation {
  if (!prev) return next;
  const live = next.stage === "NEW" || next.stage === "FINALIZING";
  return {
    exclusiveTemplate: next.exclusiveTemplate || prev.exclusiveTemplate,
    bytecodeHasRegistry: next.bytecodeHasRegistry ?? prev.bytecodeHasRegistry,
    stage: next.stage === "UNKNOWN" ? prev.stage : next.stage,
    progress: next.progress ?? prev.progress,
    agentWallets: next.agentWallets ?? prev.agentWallets,
    feeWei: next.feeWei ?? prev.feeWei,
    hasWalletCap: next.hasWalletCap ?? prev.hasWalletCap,
    hasTxCap: next.hasTxCap ?? prev.hasTxCap,
    drained: next.drained ?? prev.drained,
    pooled: next.pooled === true || next.stage === "MIGRATED" ? true : live ? null : (next.pooled ?? prev.pooled),
    ageMs: next.ageMs ?? prev.ageMs,
  };
}

export function bytecodeHasAgentRegistry(code: string): boolean {
  const hex = code.toLowerCase().replace(/^0x/, "");
  if (!hex || /^0+$/.test(hex)) return false;
  return hex.includes(AGENT_ID_REGISTRY.slice(2));
}

export function usdMicros(amount: string): bigint {
  if (!AMOUNT.test(amount)) {
    throw new AppError("VALIDATION_ERROR", "Invalid USDT amount", 400);
  }
  const [whole, frac = ""] = amount.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, "0"));
}

export function confirmPhrase(amount: string): string {
  usdMicros(amount);
  return `确认狙击 ${amount} USDT`;
}

export function assertSpend(
  amount: string,
  maxUsd: number,
  spentMicros: bigint,
  dailyUsdCap: number,
): bigint {
  const micros = usdMicros(amount);
  if (micros <= 0n || micros > BigInt(maxUsd) * 1_000_000n) {
    throw new AppError("VALIDATION_ERROR", "Amount exceeds the per-target cap", 400);
  }
  if (spentMicros + micros > BigInt(dailyUsdCap) * 1_000_000n) {
    throw new AppError("DAILY_CAP", "Sniper daily USDT cap reached", 409);
  }
  return micros;
}

export function shanghaiDayStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value;
  return new Date(`${pick("year")}-${pick("month")}-${pick("day")}T00:00:00+08:00`);
}

function kindOf(obs: SniperObservation): Classified["kind"] {
  if (obs.feeWei == null || !/^\d+$/.test(obs.feeWei)) {
    return obs.exclusiveTemplate ? "PAID" : "UNKNOWN";
  }
  return BigInt(obs.feeWei) === 0n ? "FREE" : "PAID";
}

function validProgress(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function knownCount(value: number | null): value is number {
  return value != null && Number.isInteger(value) && value >= 0;
}

function capReason(obs: SniperObservation): SniperReason | null {
  if (obs.hasWalletCap === true || obs.hasTxCap === true) return null;
  if (obs.hasWalletCap === false && obs.hasTxCap === false) return "NO_CAP";
  return "CAP_UNKNOWN";
}

function skip(kind: Classified["kind"], reason: SniperReason): Classified {
  return { kind, status: "SKIPPED", reasons: [reason] };
}
