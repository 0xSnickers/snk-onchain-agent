import { DexscreenerProvider } from "../src/modules/market/dexscreener.provider";
import { NetworkService } from "../src/common/network.service";
describe("MarketService", () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });
  it("filters by network, preserves null data, sorts liquidity and caches", async () => {
    const pair = (chainId: string, liquidity: number) => ({
      chainId,
      pairAddress: String(liquidity),
      dexId: "dex",
      baseToken: { name: "Test", symbol: "T", address: "0xabc" },
      quoteToken: { symbol: "USD" },
      liquidity: { usd: liquidity },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pairs: [pair("base", 10000), pair("bsc", 1), pair("bsc", 200)],
      }),
    });
    const service = new DexscreenerProvider({
      json: async (...args: unknown[]) =>
        (await global.fetch(args[0] as string)).json(),
    } as unknown as NetworkService);
    const result = (await service.search("BNB", "bsc")) as {
      pairs: { liquidityUsd: number; priceUsd: string | null }[];
    };
    expect(result.pairs.map((p) => p.liquidityUsd)).toEqual([200, 1]);
    expect(result.pairs[0].priceUsd).toBeNull();
    await service.search("BNB", "bsc");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it("reports upstream errors rather than returning fabricated rows", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network"));
    await expect(
      new DexscreenerProvider({
        json: async (...args: unknown[]) =>
          (await global.fetch(args[0] as string)).json(),
      } as unknown as NetworkService).search("BNB", "bsc"),
    ).rejects.toMatchObject({ code: "MARKET_UNAVAILABLE" });
  });
});
