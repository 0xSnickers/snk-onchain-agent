import { httpClient } from './httpClient';
import type { ApiResponse } from '@/types/api';
import type {
  AgentLaunchMarket,
  WalletStatus,
  KolCategory,
  KolTimeline,
  KolSyncResult,
  MarketChain,
  MemeMarket,
  MarketKline,
  CandleResolution,
  WalletOverview,
  WalletHoldings,
  Login,
  MarketResult,
  KolResult,
  Kol,
} from '@snk/contracts';
async function get<T>(path: string, params?: Record<string, string>) {
  return (await httpClient.get<ApiResponse<T>>(path, { params })).data.data;
}
export const onchainApi = {
  agentLaunches: () => get<AgentLaunchMarket>('/market/agent-launches', { chain: 'bsc' }),
  health: () => get<{ status: string; database: string }>('/health'),
  wallet: () => get<WalletStatus>('/wallet/status'),
  holdings: () => get<WalletHoldings>('/wallet/holdings'),
  overview: () => get<WalletOverview>('/wallet/overview'),
  signin: async () => (await httpClient.post<ApiResponse<Login>>('/wallet/signin')).data.data,
  market: (q: string, chain: string) => get<MarketResult>('/market/pairs', { q, chain }),
  tokens: (chain: MarketChain) => get<MemeMarket>('/market/tokens', { chain }),
  kline: (chain: MarketChain, address: string, resolution: CandleResolution) =>
    get<MarketKline>('/market/kline', { chain, address, resolution }),
  kolPosts: (id: string) => get<KolTimeline>(`/kols/${id}/posts`),
  syncKol: async ({ id, more = false }: { id: string; more?: boolean }) =>
    (await httpClient.post<ApiResponse<KolSyncResult>>(`/kols/${id}/sync`, { more })).data.data,
  kols: () => get<KolResult>('/kols'),
  addKol: async (input: { handle: string; category?: KolCategory; note?: string }) =>
    (await httpClient.post<ApiResponse<Kol>>('/kols', input)).data.data,
  updateKol: async ({ id, ...input }: { id: string; handle: string; category: KolCategory }) =>
    (await httpClient.patch<ApiResponse<Kol>>(`/kols/${id}`, input)).data.data,
  removeKol: async (id: string) => {
    await httpClient.delete(`/kols/${id}`);
  },
};
