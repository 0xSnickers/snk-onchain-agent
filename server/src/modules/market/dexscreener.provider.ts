import { Injectable } from "@nestjs/common";
import { NetworkService } from "../../common/network.service";
import { AppError } from "../../common/http";
import { imageUrl } from "../../common/image-url";
interface Pair {
  info?: { imageUrl?: string };
  chainId: string;
  dexId: string;
  pairAddress: string;
  url: string;
  baseToken: { symbol: string; name: string; address: string };
  quoteToken: { symbol: string };
  priceUsd?: string;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  priceChange?: { h24?: number };
}
@Injectable()
export class DexscreenerProvider {
  constructor(private readonly network: NetworkService) {}
  private cache = new Map<string, { expires: number; data: unknown }>();
  async search(q: string, chain: string) {
    const key = `${chain}:${q}`;
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.data;
    try {
      const payload = await this.network.json<{ pairs?: Pair[] }>(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
      );
      if (!Array.isArray(payload.pairs))
        throw new AppError(
          "MARKET_INVALID_RESPONSE",
          "DEX Screener returned invalid pairs",
        );
      const pairs = (payload.pairs || [])
        .filter((p) => p.chainId === chain)
        .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
        .slice(0, 15)
        .map((p) => ({
          chainId: p.chainId,
          dex: p.dexId,
          pairAddress: p.pairAddress,
          symbol: p.baseToken.symbol,
          name: p.baseToken.name,
          imageUrl: imageUrl(p.info?.imageUrl),
          tokenAddress: p.baseToken.address,
          quote: p.quoteToken.symbol,
          priceUsd: p.priceUsd ?? null,
          volume24h: p.volume?.h24 ?? null,
          liquidityUsd: p.liquidity?.usd ?? null,
          change24h: p.priceChange?.h24 ?? null,
          url: `https://dexscreener.com/${encodeURIComponent(p.chainId)}/${encodeURIComponent(p.pairAddress)}`,
        }));
      const data = {
        source: "DEX Screener",
        fetchedAt: new Date().toISOString(),
        query: q,
        chain,
        pairs,
      };
      if (this.cache.size >= 100) this.cache.clear();
      this.cache.set(key, { expires: Date.now() + 60000, data });
      return data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "MARKET_UNAVAILABLE",
        "DEX Screener request failed or timed out",
      );
    }
  }
}
