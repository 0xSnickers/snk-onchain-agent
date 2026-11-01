import type { AgentLaunchToken } from "../../../../packages/contracts/src/launch";
import type {
  SniperKind,
  SniperPreview,
  SniperSignals,
  SniperSource,
  SniperStage,
  SniperTarget,
} from "../../../../packages/contracts/src/sniper";
import {
  classify,
  mergeObservation,
  nextStatus,
  type SniperControls,
  type SniperObservation,
  type SniperReason,
  type SniperStatus,
} from "./sniper-policy";

export interface StoredTarget {
  id: string;
  chainId: "56";
  contractAddress: string;
  symbol: string;
  name: string;
  source: SniperSource;
  stage: SniperStage;
  kind: SniperKind;
  status: SniperStatus;
  progress: number | null;
  holders: number | null;
  agentWallets: number | null;
  reasons: SniperReason[];
  imageUrl: string | null;
  platform: string | null;
  url: string;
  armedAt: string | null;
  preview: SniperPreview | null;
  discoveredAt: string;
  updatedAt: string;
  evidence: SniperObservation;
}

export interface FeedWrite {
  contractAddress: string;
  source: SniperSource;
  symbol: string;
  name: string;
  stage: SniperStage;
  kind: SniperKind;
  status: SniperStatus;
  progress: number | null;
  holders: number | null;
  agentWallets: number | null;
  reasons: SniperReason[];
  imageUrl: string | null;
  platform: string;
  url: string;
  preview: SniperPreview | null;
  evidence: SniperObservation;
}

export interface FeedDisplay {
  contractAddress: string;
  source: SniperSource;
  symbol: string;
  name: string;
  holders: number | null;
  imageUrl: string | null;
  platform: string;
  url: string;
}

export function present(target: StoredTarget): SniperTarget {
  return {
    id: target.id,
    chainId: "56",
    contractAddress: target.contractAddress,
    symbol: target.symbol,
    name: target.name,
    source: target.source,
    stage: target.stage,
    kind: target.kind,
    status: target.status,
    progress: target.progress,
    holders: target.holders,
    agentWallets: target.agentWallets,
    reasons: target.reasons,
    signals: signalsOf(target.evidence),
    imageUrl: target.imageUrl,
    platform: target.platform,
    url: target.url,
    armedAt: target.armedAt,
    preview: target.status === "AWAITING_CONFIRM" ? target.preview : null,
    discoveredAt: target.discoveredAt,
    updatedAt: target.updatedAt,
  };
}

export function projectTarget(
  existing: StoredTarget | null,
  observation: SniperObservation,
  display: FeedDisplay,
  controls: SniperControls,
): FeedWrite {
  const evidence = mergeObservation(existing?.evidence, observation);
  const classified = classify(evidence, controls);
  const status = nextStatus(existing?.status ?? "WATCHING", classified, controls.armed);
  return {
    contractAddress: display.contractAddress,
    source: display.source,
    symbol: clip(display.symbol, 32),
    name: clip(display.name, 80),
    stage: evidence.stage,
    kind: classified.kind,
    status,
    progress: evidence.progress,
    holders: display.holders,
    agentWallets: evidence.agentWallets,
    reasons: classified.reasons,
    imageUrl: display.imageUrl,
    platform: display.platform,
    url: display.url,
    preview: status === "AWAITING_CONFIRM" ? (existing?.preview ?? null) : null,
    evidence,
  };
}

export function planFeed(
  existing: StoredTarget[],
  tokens: AgentLaunchToken[],
  migrated: string[],
  controls: SniperControls,
): FeedWrite[] {
  const byAddress = new Map(existing.map((target) => [target.contractAddress, target]));
  const migratedSet = new Set(migrated);
  const ranked = new Map<string, AgentLaunchToken>();
  for (const token of tokens) {
    const prev = ranked.get(token.address);
    if (!prev || rank(token.stage) >= rank(prev.stage)) ranked.set(token.address, token);
  }
  const writes: FeedWrite[] = [];
  for (const token of ranked.values()) {
    const prev = byAddress.get(token.address) ?? null;
    const pooled = migratedSet.has(token.address) || token.stage === "MIGRATED";
    writes.push(
      projectTarget(prev, feedObservation(token, pooled), feedDisplay(token, prev), controls),
    );
  }
  for (const address of migratedSet) {
    if (ranked.has(address)) continue;
    const prev = byAddress.get(address);
    if (!prev || prev.source !== "FOUR_EXCLUSIVE") continue;
    writes.push(
      projectTarget(
        prev,
        { ...prev.evidence, stage: "MIGRATED", pooled: true },
        displayFrom(prev),
        controls,
      ),
    );
  }
  return writes;
}

export function reclassify(existing: StoredTarget[], controls: SniperControls): FeedWrite[] {
  return existing.map((target) => projectTarget(target, target.evidence, displayFrom(target), controls));
}

function feedObservation(token: AgentLaunchToken, pooled: boolean): SniperObservation {
  return {
    exclusiveTemplate: token.evidence === "AGENT_ID_TEMPLATE",
    bytecodeHasRegistry: null,
    stage: pooled ? "MIGRATED" : token.stage,
    progress: token.progress != null && Number.isFinite(token.progress) ? token.progress : null,
    agentWallets: null,
    feeWei: null,
    hasWalletCap: null,
    hasTxCap: null,
    drained: null,
    pooled: pooled ? true : null,
    ageMs: null,
  };
}

function feedDisplay(token: AgentLaunchToken, prev: StoredTarget | null): FeedDisplay {
  return {
    contractAddress: token.address,
    source: "FOUR_EXCLUSIVE",
    symbol: token.symbol || prev?.symbol || "",
    name: token.name || prev?.name || "",
    holders: token.holders ?? prev?.holders ?? null,
    imageUrl: token.imageUrl ?? prev?.imageUrl ?? null,
    platform: token.platform || "Four.meme Agent ID",
    url: token.url,
  };
}

function displayFrom(target: StoredTarget): FeedDisplay {
  return {
    contractAddress: target.contractAddress,
    source: target.source,
    symbol: target.symbol,
    name: target.name,
    holders: target.holders,
    imageUrl: target.imageUrl,
    platform: target.platform || "",
    url: target.url,
  };
}

function signalsOf(evidence: SniperObservation): SniperSignals {
  return {
    exclusiveTemplate: evidence.exclusiveTemplate,
    bytecodeHasRegistry: evidence.bytecodeHasRegistry,
    feeWei: evidence.feeWei,
    hasWalletCap: evidence.hasWalletCap,
    hasTxCap: evidence.hasTxCap,
    drained: evidence.drained,
    pooled: evidence.pooled,
    ageMs: evidence.ageMs,
  };
}

function rank(stage: string) {
  if (stage === "MIGRATED") return 3;
  if (stage === "FINALIZING") return 2;
  if (stage === "NEW") return 1;
  return 0;
}

function clip(value: string, max: number) {
  let out = "";
  for (const ch of value.trim()) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code !== 127) out += ch;
  }
  return out.slice(0, max);
}
