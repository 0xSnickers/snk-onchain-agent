import { httpClient } from './httpClient';
import type { ApiResponse } from '@/types/api';
import type {
  CandidateOutbox,
  ExecutorSession,
  DetectionScan,
  ExecutorCreateInput,
  ExecutorUpdateInput,
} from '@snk/contracts';
async function get<T>(path: string) {
  return (await httpClient.get<ApiResponse<T>>(path)).data.data;
}
async function post<T>(path: string, body: unknown = {}) {
  return (await httpClient.post<ApiResponse<T>>(path, body, { timeout: 120000 })).data.data;
}
export const delegationApi = {
  scans: () => get<DetectionScan[]>('/delegation/scans'),
  register: (input: ExecutorCreateInput) => post<ExecutorSession>('/delegation/executors', input),
  update: async (id: string, input: ExecutorUpdateInput) =>
    (
      await httpClient.patch<ApiResponse<ExecutorSession>>(
        `/delegation/executors/${encodeURIComponent(id)}`,
        input,
      )
    ).data.data,
  sessions: () => get<ExecutorSession[]>('/delegation/sessions'),
  outbox: () => get<CandidateOutbox[]>('/delegation/outbox'),
  scan: () => post<{ id: string; status: string; failures: number }>('/agent/scan'),
  queue: (id: string, executorId?: string) =>
    post<CandidateOutbox>(`/delegation/candidates/${id}/queue`, executorId ? { executorId } : {}),
  confirm: (
    id: string,
    input: { walletScope: string; amount: string; asset: 'BNB' | 'USDT'; confirmationText: string },
  ) => post<CandidateOutbox>(`/delegation/briefs/${id}/confirm-buy`, input),
};
