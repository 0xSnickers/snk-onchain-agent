import { Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { NetworkService } from "../../common/network.service";
import { AppError } from "../../common/http";
import { object, text, decimal } from "../../common/safe-data";
import { agentEnv } from "../../config/agent-env";
import { env } from "../../config/env";
export interface Audit {
  available: boolean;
  riskLevel: string | null;
  severity: number | null;
  buyTax: string | null;
  sellTax: string | null;
  hits: { title: string; description: string }[];
  cautions: string[];
}
@Injectable()
export class ResearchProvider {
  constructor(private readonly network: NetworkService) {}
  async audit(chainId: string, contractAddress: string): Promise<Audit> {
    const response = await this.network.json<{ code: string; data: unknown }>(
      "https://web3.binance.com/bapi/defi/v1/public/wallet-direct/security/token/audit",
      { binanceChainId: chainId, contractAddress, requestId: randomUUID() },
      { source: "agent", "User-Agent": "binance-web3/1.4 (Skill)" },
    );
    if (response.code !== "000000")
      throw new AppError(
        "AUDIT_UNAVAILABLE",
        "Token audit provider rejected the request",
      );
    const data = object(response.data),
      extra = object(data.extraInfo);
    if (
      data.hasResult !== true ||
      data.isSupported !== true ||
      !Array.isArray(data.riskItems)
    )
      return {
        available: false,
        riskLevel: null,
        severity: null,
        buyTax: null,
        sellTax: null,
        hits: [],
        cautions: [],
      };
    const details = data.riskItems
      .flatMap((v) =>
        Array.isArray(object(v).details)
          ? (object(v).details as unknown[])
          : [],
      )
      .map(object);
    const severity = typeof data.riskLevel === "number" ? data.riskLevel : null;
    return {
      available: true,
      riskLevel: text(data.riskLevelEnum) || null,
      severity,
      buyTax: decimal(extra.buyTax),
      sellTax: decimal(extra.sellTax),
      hits: details
        .filter((d) => d.isHit === true)
        .map((d) => ({
          title: text(d.title),
          description: text(d.description, 1000),
        })),
      cautions: details
        .filter((d) => d.riskType === "CAUTION")
        .map((d) => text(d.title)),
    };
  }
  async info(
    command: "meta" | "dynamic",
    chainId: string,
    contractAddress: string,
  ) {
    const path =
      process.env.TOKEN_INFO_CLI_PATH ||
      join(homedir(), ".agents/skills/query-token-info/scripts/cli.mjs");
    const response = await new Promise<Record<string, unknown>>(
      (resolve, reject) =>
        execFile(
          process.execPath,
          [path, command, JSON.stringify({ chainId, contractAddress })],
          { timeout: 20000, maxBuffer: 1024 * 1024 },
          (error, stdout) => {
            try {
              const r = JSON.parse(stdout);
              if (error || r.code !== "000000")
                return reject(
                  new AppError(
                    "TOKEN_INFO_UNAVAILABLE",
                    "Token info provider failed",
                  ),
                );
              resolve(object(r.data));
            } catch {
              reject(
                new AppError(
                  "TOKEN_INFO_UNAVAILABLE",
                  "Token info CLI unavailable or returned invalid JSON",
                ),
              );
            }
          },
        ),
    );
    if (command === "meta")
      return {
        name: text(response.name, 100),
        symbol: text(response.symbol, 30),
        links: (Array.isArray(response.links) ? response.links : [])
          .slice(0, 10)
          .map(object)
          .map((l) => ({
            label: text(l.label, 40),
            link: /^https:\/\//.test(String(l.link)) ? text(l.link, 500) : "",
          }))
          .filter((l) => l.link),
      };
    return {
      price: decimal(response.price),
      volume24h: decimal(response.volume24h),
      liquidity: decimal(response.liquidity),
      holders: decimal(response.holders),
      top10Percent: decimal(
        response.holdersTop10Percent ?? response.top10Percent,
      ),
    };
  }
  async social(contractAddress: string) {
    if (!agentEnv.socialEnabled || !env.xToken)
      return { state: "NOT_CONFIGURED", posts: [] };
    const url =
      "https://api.x.com/2/tweets/search/recent?max_results=10&tweet.fields=created_at&query=" +
      encodeURIComponent(contractAddress + " -is:retweet");
    const result = await this.network.json<{
      data?: unknown[];
      errors?: unknown[];
    }>(url, undefined, { Authorization: `Bearer ${env.xToken}` });
    if (result.errors?.length)
      throw new AppError(
        "SOCIAL_UNAVAILABLE",
        "X search returned provider errors",
      );
    return {
      state: "AVAILABLE",
      posts: (result.data || [])
        .slice(0, 5)
        .map(object)
        .map((p) => ({
          text: text(p.text, 1000),
          url: /^\d+$/.test(String(p.id))
            ? `https://x.com/i/web/status/${p.id}`
            : "",
          createdAt: text(p.created_at),
        })),
    };
  }
}
