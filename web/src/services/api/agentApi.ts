import { httpClient } from './httpClient';
import type { ApiResponse } from '@/types/api';
import type {
  WalletIdentity,
  AgentConfig,
  RunPage,
  AgentRunDetail,
  MintCandidate,
  ResearchBrief,
  AgentNotification,
  ActivityPage,
  HistorySync,
  CandidateInput,
} from '@snk/contracts';
async function get<T>(path: string, params?: Record<string, string>) {
  return (await httpClient.get<ApiResponse<T>>(path, { params })).data.data;
}
async function post<T>(path: string, body: unknown = {}) {
  return (await httpClient.post<ApiResponse<T>>(path, body, { timeout: 120000 })).data.data;
}
export const agentApi = {
  identity: (walletScope?: string) =>
    get<WalletIdentity>('/wallet/identity', walletScope ? { walletScope } : undefined),
  config: () => get<AgentConfig>('/agent/config'),
  runs: (cursor?: string, walletScope?: string) =>
    get<RunPage>('/agent/runs', {
      ...(cursor ? { cursor } : {}),
      ...(walletScope ? { walletScope } : {}),
    }),
  run: (id: string, walletScope?: string) =>
    get<AgentRunDetail>(`/agent/runs/${id}`, walletScope ? { walletScope } : undefined),
  scan: () => post<{ id: string; status: string }>('/agent/scan'),
  reconcile: () => post<{ checked: number }>('/agent/reconcile'),
  candidates: () => get<MintCandidate[]>('/mint/candidates'),
  addCandidate: (input: CandidateInput) => post<MintCandidate>('/mint/candidates', input),
  prepare: (id: string) => post<AgentRunDetail>(`/mint/free/${id}/retry`),
  research: (id: string) => post<ResearchBrief>(`/mint/${id}/research`),
  briefs: () => get<ResearchBrief[]>('/research/briefs'),
  confirm: (
    id: string,
    input: { amount: string; asset: string; slippage: string; confirmationText: string },
  ) => post<AgentRunDetail>(`/research/briefs/${id}/confirm-buy`, input),
  execute: (id: string, input: { confirmationText?: string; confirmationId?: string }) =>
    post<AgentRunDetail>(`/agent/runs/${id}/execute`, input),
  notifications: (walletScope?: string) =>
    get<AgentNotification[]>('/agent/notifications', walletScope ? { walletScope } : undefined),
  read: (id: string, walletScope?: string) =>
    post(
      `/agent/notifications/${id}/read${walletScope ? `?walletScope=${encodeURIComponent(walletScope)}` : ''}`,
    ),
  activity: (type: string, cursor?: string, walletScope?: string) =>
    get<ActivityPage>('/wallet/activity', {
      type,
      ...(cursor ? { cursor } : {}),
      ...(walletScope ? { walletScope } : {}),
    }),
  sync: (cursor?: string) => post<HistorySync>('/wallet/activity/sync', cursor ? { cursor } : {}),
};
