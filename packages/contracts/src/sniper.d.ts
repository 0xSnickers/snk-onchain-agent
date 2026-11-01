export type SniperStatus =
  | "WATCHING"
  | "NOTIFY_ONLY"
  | "THRESHOLD"
  | "ARMED"
  | "AWAITING_CONFIRM"
  | "CONFIRMED"
  | "SKIPPED";

export type SniperKind = "FREE" | "PAID" | "UNKNOWN";
export type SniperSource = "FOUR_EXCLUSIVE" | "MANUAL";
export type SniperStage = "NEW" | "FINALIZING" | "MIGRATED" | "UNKNOWN";

export interface SniperSignals {
  exclusiveTemplate: boolean;
  bytecodeHasRegistry: boolean | null;
  feeWei: string | null;
  hasWalletCap: boolean | null;
  hasTxCap: boolean | null;
  drained: boolean | null;
  pooled: boolean | null;
  ageMs: number | null;
}

export interface SniperPreview {
  amount: string;
  asset: "USDT";
  expiresAt: string;
}

export interface SniperTarget {
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
  reasons: string[];
  signals: SniperSignals;
  imageUrl: string | null;
  platform: string | null;
  url: string;
  armedAt: string | null;
  preview: SniperPreview | null;
  discoveredAt: string;
  updatedAt: string;
}

export interface SniperControls {
  armed: boolean;
  minProgress: number;
  minAgentWallets: number;
  maxUsd: number;
  dailyUsdCap: number;
}

export interface SniperSourceHealth {
  stage: "NEW" | "FINALIZING" | "MIGRATED";
  status: "OK" | "ERROR";
  count: number;
  error: { code: string; message: string } | null;
}

export interface SniperBoard {
  chain: "bsc";
  coverage: "BOUNDED_SAMPLE";
  broadcast: false;
  registry: string;
  fetchedAt: string;
  controls: SniperControls;
  targets: SniperTarget[];
  sources: SniperSourceHealth[];
  refreshError: { code: string; message: string } | null;
}

export interface SniperIntent {
  id: string;
  targetId: string;
  amount: string;
  asset: "USDT";
  confirmationText: string;
  status: "RECORDED";
  broadcast: false;
  reason: "WALLET_DELEGATED";
  createdAt: string;
}
