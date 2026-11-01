/** Dynamic executor ids: /^[a-z][a-z0-9_-]{0,31}$/ (e.g. w1, w2, w3, cold-1). */
export type ExecutorId = string;
export type ExecutorRole = 'MONITOR' | 'FREE_MINT' | 'PAID';
export type ExecutorSourceRole = ExecutorRole | 'COLLAB' | 'STANDBY';
export interface ExecutorSession {
  id: ExecutorId;
  sourceRoles?: ExecutorSourceRole[];
  agentId?: string | null;
  label?: string;
  role: ExecutorRole;
  isDefault?: boolean;
  walletScope: string;
  state: 'CONNECTED' | 'UNCONNECTED';
  paused: boolean;
  heartbeatAt: string | null;
  online: boolean;
}
export interface CandidateOutbox {
  id: string;
  candidateId: string;
  kind: 'FREE_MINT' | 'PAID_RESEARCH' | 'PAID_BUY';
  provider: string;
  walletScope: string;
  executorId: ExecutorId;
  status: 'PENDING' | 'CLAIMED' | 'SUBMITTED' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'EXPIRED';
  payload: {
    candidateId: string;
    kind: CandidateOutbox['kind'];
    chainId: '56';
    contract: string;
    name?: string | null;
    symbol?: string | null;
    provider: string;
    walletScopeHint: string;
    inputData?: string;
    gates: {priceWei?: string | null; holders?: number | null; agentMustRevalidate: boolean; previewRequired?: boolean; quoteRequired?: boolean; auditRequired?: boolean};
    createdAt: string;
  };
  confirmation: {amount: string; asset: 'BNB' | 'USDT'; confirmationText: string; confirmedAt: string; briefId: string} | null;
  expiresAt: string;
  txHash: string | null;
  runId: string | null;
  createdAt: string;
}
export interface ClaimedCandidate extends CandidateOutbox { claimToken: string }

export interface DetectionScan {
  id: string;
  status: string;
  summary: string;
  startedAt: string;
  actions: {name: string; decision: string; detailJson: Record<string, unknown>}[];
}
export interface SessionHeartbeat {
  walletScope: string;
  state: 'CONNECTED' | 'UNCONNECTED';
  paused?: boolean;
}
export interface ExecutorClaim { executorId: ExecutorId; walletScope: string }
export interface ExecutorResult extends ExecutorClaim {
  claimToken: string;
  status: 'SUBMITTED' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
  txHash?: string;
  errorCode?: string;
  previewClean?: boolean;
  priceWei?: '0';
  holders?: number;
  previewRequestId?: string;
  orderId?: string;
  orderStatus?: 'SUCCESS' | 'COMPLETED';
}

/** Grok Bot ↔ snk executor registry file shape */
export interface ExecutorRegistryFile {
  schema: 'snk-onchain-agent/executor-registry@1';
  updatedAt: string;
  executors: {
    id: ExecutorId;
    walletScope: string;
    walletAddress: string;
    roles: ExecutorSourceRole[];
    enabled: boolean;
    agentId?: string | null;
    label?: string;
    isDefault?: boolean;
  }[];
}

export interface ExecutorMetadataInput {
  sourceRoles?: ExecutorSourceRole[];
  agentId?: string | null;
}
export interface ExecutorCreateInput extends ExecutorMetadataInput {
  id: ExecutorId;
  walletScope: string;
  label?: string;
  role: ExecutorRole;
  isDefault?: boolean;
}
export interface ExecutorUpdateInput extends ExecutorMetadataInput {
  label?: string;
  role?: ExecutorRole;
  isDefault?: boolean;
  paused?: boolean;
}
