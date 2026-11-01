import { useQuery } from '@tanstack/react-query';
import type { HoldingAsset } from '@snk/contracts';
import { onchainApi } from '@/services/api/onchainApi';

export function useHoldings() {
  return useQuery({
    queryKey: ['wallet', 'holdings'],
    queryFn: onchainApi.holdings,
    retry: false,
    staleTime: 20000,
  });
}

export function byKind(assets: HoldingAsset[], kind: HoldingAsset['kind']) {
  return assets.filter((asset) => asset.kind === kind);
}

export function shortAddress(address: string) {
  return address.length < 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}
