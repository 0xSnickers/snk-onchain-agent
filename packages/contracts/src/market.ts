export type MarketChain = 'bsc' | 'solana';
export type CandleResolution = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export interface MemeToken {
  chain: MarketChain; address: string; symbol: string; name: string;
  priceUsd: string | null; changePercent: number | null; volumeUsd: number | null;
  liquidityUsd: number | null; marketCapUsd: number | null; holders: number | null;
  platform: string | null; url: string; imageUrl?: string | null;
}
export interface MemeMarket {
  source: 'GMGN'; chain: MarketChain; interval: '1h'; fetchedAt: string; tokens: MemeToken[];
}
export interface MarketCandle {
  time: number; open: number; high: number; low: number; close: number; volumeUsd: number | null;
}
export interface MarketKline {
  source: 'GMGN'; chain: MarketChain; address: string; resolution: CandleResolution;
  fetchedAt: string; candles: MarketCandle[];
}
