import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { fetch, EnvHttpProxyAgent } from "undici";
import { AppError } from "./http";
@Injectable()
export class NetworkService implements OnModuleDestroy {
  private readonly dispatcher = new EnvHttpProxyAgent();
  async json<T>(
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
    signal?: AbortSignal,
  ): Promise<T> {
    try {
      const r = await fetch(url, {
        dispatcher: this.dispatcher,
        method: body === undefined ? "GET" : "POST",
        // Leave Accept-Encoding unset so undici can use gzip. Forcing identity
        // makes the gang.fun V2 list (~166KB) miss the 12s timeout.
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "binance-web3/2.0 (Skill)",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
          : AbortSignal.timeout(12000),
        redirect: "error",
      });
      if (!r.ok)
        throw new AppError(
          r.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_HTTP_ERROR",
          `Upstream HTTP ${r.status}${r.headers.get("retry-after") ? "; retry later" : ""}`,
        );
      return (await r.json()) as T;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "UPSTREAM_UNAVAILABLE",
        "Upstream request failed or timed out",
      );
    }
  }
  async onModuleDestroy() {
    await this.dispatcher.close();
  }
}
