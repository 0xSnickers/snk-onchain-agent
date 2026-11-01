import { Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import { AppError } from "../../common/http";
import { validMarketAddress } from "./market.dto";
import { imageUrl } from "../../common/image-url";
type Row = Record<string, unknown>;
export const numberOrNull = (value: unknown): number | null => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  )
    return null;
  return (typeof value === "number" || typeof value === "string") &&
    Number.isFinite(Number(value))
    ? Number(value)
    : null;
};
const text = (v: unknown) => (typeof v === "string" ? v.slice(0, 160) : "");
@Injectable()
export class GmgnProvider {
  private queue: Promise<void> = Promise.resolve();
  private blockedUntil = 0;
  private run(args: string[]): Promise<Row> {
    const task = this.queue.then(() => this.execute(args));
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }
  private execute(args: string[]): Promise<Row> {
    if (this.blockedUntil > Date.now())
      return Promise.reject(
        new AppError(
          "GMGN_RATE_LIMITED",
          `GMGN rate limited; retry after ${new Date(this.blockedUntil).toISOString()}`,
          429,
        ),
      );
    return new Promise((resolve, reject) => {
      execFile(
        process.env.GMGN_CLI_PATH || "gmgn-cli",
        ["market", ...args, "--raw"],
        {
          timeout: 25000,
          maxBuffer: 4 * 1024 * 1024,
          env: { ...process.env, GMGN_DEBUG: "" },
        },
        (error, stdout, stderr) => {
          // Never log raw CLI output, headers or credential configuration.
          if (error) {
            if (/429|RATE_LIMIT/.test(stderr)) {
              const reset = stderr.match(/resets at (.+?) \(~/)?.[1];
              const resetTime = reset ? Date.parse(reset) : NaN;
              this.blockedUntil = Math.max(
                Date.now() + 30000,
                Number.isFinite(resetTime)
                  ? resetTime + 1000
                  : Date.now() + 60000,
              );
              return reject(
                new AppError(
                  "GMGN_RATE_LIMITED",
                  `GMGN rate limited; retry after ${new Date(this.blockedUntil).toISOString()}`,
                  429,
                ),
              );
            }
            const missing = stderr.includes("GMGN_API_KEY is required");
            return reject(
              new AppError(
                missing ? "GMGN_NOT_CONFIGURED" : "GMGN_UNAVAILABLE",
                missing
                  ? "Configure GMGN_API_KEY locally for market data"
                  : "GMGN request failed. Check CLI, network and API quota.",
                missing ? 409 : 502,
              ),
            );
          }
          try {
            const r = JSON.parse(stdout) as Row;
            if (
              !r ||
              typeof r !== "object" ||
              (r.code !== undefined && r.code !== 0)
            )
              throw new Error();
            const data = r.code === 0 ? r.data : r;
            if (!data || typeof data !== "object" || Array.isArray(data))
              throw new Error();
            resolve(data as Row);
          } catch {
            reject(
              new AppError(
                "GMGN_INVALID_RESPONSE",
                "GMGN returned an unexpected response",
              ),
            );
          }
        },
      );
    });
  }
  async trending(chain: string) {
    const data = await this.run([
      "trending",
      "--chain",
      chain === "solana" ? "sol" : "bsc",
      "--interval",
      "1h",
      "--limit",
      "20",
    ]);
    if (!Array.isArray(data.rank))
      throw new AppError("GMGN_INVALID_RESPONSE", "GMGN rank data is missing");
    const seen = new Set<string>();
    const tokens = (data.rank as Row[])
      .filter((r) => {
        const address = text(r.address);
        const id = chain === "bsc" ? address.toLowerCase() : address;
        if (
          !validMarketAddress(chain, address) ||
          seen.has(id) ||
          (r.chain && r.chain !== (chain === "solana" ? "sol" : chain))
        )
          return false;
        seen.add(id);
        return true;
      })
      .slice(0, 20)
      .map((r) => ({
        chain,
        address: text(r.address),
        symbol: text(r.symbol),
        name: text(r.name),
        imageUrl: imageUrl(r.logo),
        priceUsd: numberOrNull(r.price) === null ? null : String(r.price),
        changePercent: numberOrNull(r.price_change_percent1h),
        volumeUsd: numberOrNull(r.volume),
        liquidityUsd: numberOrNull(r.liquidity),
        marketCapUsd: numberOrNull(r.market_cap),
        holders: numberOrNull(r.holder_count),
        platform: text(r.launchpad_platform) || null,
        url: `https://gmgn.ai/${chain === "solana" ? "sol" : "bsc"}/token/${encodeURIComponent(text(r.address))}`,
      }));
    return {
      source: "GMGN",
      chain,
      interval: "1h",
      fetchedAt: new Date().toISOString(),
      tokens,
    };
  }
  async kline(chain: string, address: string, resolution: string) {
    if (!validMarketAddress(chain, address))
      throw new AppError(
        "INVALID_MARKET_ADDRESS",
        "Token address does not match the selected chain",
        400,
      );
    const data = await this.run([
      "kline",
      "--chain",
      chain === "solana" ? "sol" : "bsc",
      "--address",
      address,
      "--resolution",
      resolution,
    ]);
    if (!Array.isArray(data.list))
      throw new AppError(
        "GMGN_INVALID_RESPONSE",
        "GMGN candle data is missing",
      );
    const byTime = new Map<
      number,
      {
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volumeUsd: number | null;
      }
    >();
    for (const row of data.list as Row[]) {
      const rawTime = numberOrNull(row.time);
      const time =
        rawTime === null ? null : rawTime > 1e11 ? rawTime / 1000 : rawTime;
      const open = numberOrNull(row.open),
        high = numberOrNull(row.high),
        low = numberOrNull(row.low),
        close = numberOrNull(row.close);
      if (
        time === null ||
        !Number.isInteger(time) ||
        time <= 0 ||
        time > 1e11 ||
        open === null ||
        high === null ||
        low === null ||
        close === null ||
        Math.min(open, high, low, close) <= 0 ||
        high < Math.max(open, close, low) ||
        low > Math.min(open, close, high)
      )
        throw new AppError(
          "GMGN_INVALID_RESPONSE",
          "GMGN returned invalid OHLC data",
        );
      const volume = numberOrNull(row.volume);
      byTime.set(time, {
        time,
        open,
        high,
        low,
        close,
        volumeUsd: volume !== null && volume >= 0 ? volume : null,
      });
    }
    return {
      source: "GMGN",
      chain,
      address,
      resolution,
      fetchedAt: new Date().toISOString(),
      candles: [...byTime.values()].sort((a, b) => a.time - b.time).slice(-500),
    };
  }
}
