import { useQuery } from '@tanstack/react-query';
import { onchainApi } from '@/services/api/onchainApi';
export const onchainKeys = {
  wallet: ['wallet'] as const,
  overview: ['wallet', 'overview'] as const,
  health: ['health'] as const,
  kols: ['kols'] as const,
  market: (query: string, chain: string) => ['market', query, chain] as const,
};
export function useWallet() {
  return useQuery({
    queryKey: onchainKeys.wallet,
    queryFn: onchainApi.wallet,
    retry: false,
    refetchInterval: 15000,
  });
}
export function useMarket(query: string, chain: string, enabled = true) {
  return useQuery({
    queryKey: onchainKeys.market(query, chain),
    enabled,
    queryFn: () => onchainApi.market(query, chain),
    retry: false,
    staleTime: 60000,

  });
}
