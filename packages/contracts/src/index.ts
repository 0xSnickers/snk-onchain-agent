export interface Login {
  pairingCode?: string; urlForWeb?: string; expireAt?: string; state: string; error?: string;
}
export interface WalletStatus { status: string; login: Login | null; statusError?: { code: string; message: string } }
export interface Balance { symbol: string; address: string; binanceChainId: string; balance: string; price: string; value: string }
export type HolderConfidence = "high" | "ok" | "lower_bound" | "unknown";
export interface HoldingAsset {
  kind: "NATIVE" | "TOKEN" | "NFT"; symbol: string; name: string; contractAddress: string | null;
  balance: string; decimals: number | null; valueUsd: string | null;
  holders: number | null; holdersConfidence: HolderConfidence | null;
}
export interface WalletHoldings {
  address: string; scope: string; chainId: string; source: string; fetchedAt: string;
  bnbPriceUsd: string | null; holdersSnapshot: { fetchedAt: string } | null;
  failures: { contractAddress: string; name: string; holders: number | null; holdersConfidence: HolderConfidence | null; note: string | null }[];
  assets: HoldingAsset[];
}
export interface WalletOverview {
  addresses: { binanceChainId: string; chainName: string; address: string }[];
  balances: Balance[]; chains: { binanceChainId: string; name: string }[]; sessionExpireTime: string | number | null;
}
export interface MarketPair {
  chainId: string; dex: string; pairAddress: string; symbol: string; name: string; tokenAddress: string;
  imageUrl?: string | null; quote: string; priceUsd: string | null; volume24h: number | null; liquidityUsd: number | null; change24h: number | null; url: string;
}
export interface MarketResult { source: string; fetchedAt: string; query: string; chain: string; pairs: MarketPair[] }
export interface Kol {
  id: string; handle: string; displayName?: string | null; avatarUrl?: string | null;
  category?: import('./kol').KolCategory; source?: import('./kol').KolSource;
  lastSyncedAt?: string | null; syncError?: string | null; note: string;
  profileUrl?: string | null; projects?: string[]; summary?: string; sharedAt?: string | null;
  createdAt: string;
}
export interface KolResult { accounts: Kol[]; x: { configured: boolean; state: string } }

export type * from './agent-run';
export type * from './market';

export type * from './kol';
export type * from './launch';
export * from './delegation';
