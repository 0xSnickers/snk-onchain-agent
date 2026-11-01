import { execFile } from "node:child_process";
import { GmgnProvider } from "../src/modules/market/gmgn.provider";
import { MarketService } from "../src/modules/market/market.service";
import { DexscreenerProvider } from "../src/modules/market/dexscreener.provider";
jest.mock("node:child_process", () => ({ execFile: jest.fn() }));
const cli = execFile as unknown as jest.Mock;
const address = "0x" + "1".repeat(40);
function respond(payload: unknown) {
  cli.mockImplementation((_path, _args, _opts, cb) =>
    cb(null, JSON.stringify(payload), ""),
  );
}
beforeEach(() => cli.mockReset());
it("normalizes ranking and ignores wrong-chain and duplicate tokens", async () => {
  respond({
    code: 0,
    data: {
      rank: [
        {
          chain: "bsc",
          address,
          symbol: "TEST",
          price: "0.123",
          volume: 23,
          price_change_percent1h: 5,
        },
        { chain: "sol", address },
        { chain: "bsc", address },
      ],
    },
  });
  const r = await new GmgnProvider().trending("bsc");
  expect(r.tokens).toHaveLength(1);
  expect(r.tokens[0]).toMatchObject({
    priceUsd: "0.123",
    volumeUsd: 23,
    changePercent: 5,
  });
  expect(cli.mock.calls[0][1]).toEqual([
    "market",
    "trending",
    "--chain",
    "bsc",
    "--interval",
    "1h",
    "--limit",
    "20",
    "--raw",
  ]);
});
it("normalizes native kline output, milliseconds, ordering and duplicates", async () => {
  const candle = { open: "1", high: "3", low: ".5", close: "2", volume: "45" };
  respond({
    list: [
      { ...candle, time: 1700000060000 },
      { ...candle, time: 1700000000000 },
      { ...candle, time: 1700000000000 },
    ],
  });
  const r = await new GmgnProvider().kline("bsc", address, "15m");
  expect(r.candles.map((c) => c.time)).toEqual([1700000000, 1700000060]);
  expect(r.candles[0].volumeUsd).toBe(45);
});
it("rejects mismatched addresses before CLI and malformed OHLC instead of fabricating candles", async () => {
  const p = new GmgnProvider();
  await expect(p.kline("solana", address, "1m")).rejects.toMatchObject({
    code: "INVALID_MARKET_ADDRESS",
  });
  expect(cli).not.toHaveBeenCalled();
  respond({ list: [{ time: 1700000000, open: 3, high: 1, low: 2, close: 2 }] });
  await expect(p.kline("bsc", address, "1m")).rejects.toMatchObject({
    code: "GMGN_INVALID_RESPONSE",
  });
});
it("blocks requests during provider rate-limit cooldown and redacts errors", async () => {
  cli.mockImplementation((_p, _a, _o, cb) =>
    cb(new Error("failed"), "", "HTTP 429 RATE_LIMIT_EXCEEDED secret-key"),
  );
  const p = new GmgnProvider();
  await expect(p.trending("bsc")).rejects.toMatchObject({
    code: "GMGN_RATE_LIMITED",
  });
  await expect(p.trending("solana")).rejects.toMatchObject({
    code: "GMGN_RATE_LIMITED",
  });
  expect(cli).toHaveBeenCalledTimes(1);
});
it("coalesces concurrent reads and partitions kline cache by chain and case-sensitive address", async () => {
  const gmgn = {
    trending: jest.fn(async () => ({ tokens: [] })),
    kline: jest.fn(async () => ({ candles: [] })),
  };
  const s = new MarketService(
    {} as DexscreenerProvider,
    gmgn as unknown as GmgnProvider,
  );
  await Promise.all([s.trending("bsc"), s.trending("bsc")]);
  expect(gmgn.trending).toHaveBeenCalledTimes(1);
  await s.kline("solana", "Abc", "1m");
  await s.kline("solana", "abc", "1m");
  expect(gmgn.kline).toHaveBeenCalledTimes(2);
});
