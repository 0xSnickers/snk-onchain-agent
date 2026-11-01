import { Injectable } from "@nestjs/common";
import { DexscreenerProvider } from "./dexscreener.provider";
import { GmgnProvider } from "./gmgn.provider";
@Injectable()
export class MarketService {
  private cache = new Map<string, { expires: number; data: unknown }>();
  private pending = new Map<string, Promise<unknown>>();
  constructor(
    private readonly dex: DexscreenerProvider,
    private readonly gmgn: GmgnProvider,
  ) {}
  search(q: string, chain: string) {
    return this.dex.search(q, chain);
  }
  trending(chain: string) {
    return this.cached(`rank:${chain}`, 60000, () => this.gmgn.trending(chain));
  }
  kline(chain: string, address: string, resolution: string) {
    // Solana addresses are case-sensitive. Cache by full chain/address/resolution.
    return this.cached(`kline:${chain}:${address}:${resolution}`, 30000, () =>
      this.gmgn.kline(chain, address, resolution),
    );
  }
  private async cached(key: string, ttl: number, load: () => Promise<unknown>) {
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.data;
    if (this.pending.has(key)) return this.pending.get(key);
    const task = load()
      .then((data) => {
        if (this.cache.size >= 100)
          this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { expires: Date.now() + ttl, data });
        return data;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, task);
    return task;
  }
}
