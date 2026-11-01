import { Injectable } from "@nestjs/common";
import { NetworkService } from "../../common/network.service";
import { AppError } from "../../common/http";
import type { LaunchStage } from "../../../../packages/contracts/src/launch";
import { address, image, number, row, token } from "./launch-normalize";
const FOUR =
  "https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/rank/list/ai";
const VERSION = "openfour.meme.AgentIdExclusive";
@Injectable()
export class LaunchHttpProvider {
  constructor(private readonly network: NetworkService) {}
  async four(stage: LaunchStage) {
    const rankType = { NEW: 10, FINALIZING: 20, MIGRATED: 30 }[stage];
    const response = row(
      await this.network.json(FOUR, {
        chainId: "56",
        rankType,
        protocol: [2004],
        tokenVersionFilter: { "2004": [VERSION] },
        limit: 100,
      }),
    );
    if (
      response.success !== true ||
      response.code !== "000000" ||
      !Array.isArray(response.data)
    )
      throw new AppError(
        "LAUNCH_UPSTREAM_ERROR",
        "Binance Agent launch feed failed or returned invalid data",
      );
    return response.data.map(row).flatMap((r) => {
      const a = address(r.contractAddress);
      // Enforce locally too: unknown filters can silently be ignored upstream.
      if (
        !a ||
        String(r.chainId) !== "56" ||
        Number(r.protocol) !== 2004 ||
        r.tokenVersion !== VERSION
      )
        return [];
      if (r.migrateStatus == null) return [];
      if (
        stage === "MIGRATED"
          ? Number(r.migrateStatus) !== 1
          : Number(r.migrateStatus) !== 0
      )
        return [];
      return [
        {
          ...token("FOUR_AGENT", stage, a),
          symbol: String(r.symbol ?? ""),
          name: String(r.name ?? ""),
          priceUsd: number(r.price) === null ? null : String(r.price),
          changePercent: number(r.priceChange),
          volumeUsd: number(r.volume),
          liquidityUsd: number(r.liquidity),
          marketCapUsd: number(r.marketCap),
          holders: number(r.holders),
          progress: number(r.progress),
          imageUrl: image(r.icon, "https://bin.bnbstatic.com"),
          platform: "Four.meme Agent ID",
        },
      ];
    });
  }
  async gang(v2: boolean) {
    const result = row(
      await this.network.json(
        `https://gang.fun/api/${v2 ? "stocks/" : ""}tokens?sort=new&limit=100&offset=0`,
      ),
    );
    if (!Array.isArray(result.items))
      throw new AppError(
        "LAUNCH_INVALID_RESPONSE",
        "Invalid gang.fun token list",
      );
    return result.items.map(row).flatMap((r) => {
      const a = address(r.address);
      if (!a || (r.chainId != null && Number(r.chainId) !== 56)) return [];
      // Unknown graduation state must not be guessed as an internal market.
      if (typeof r.graduated !== "boolean")
        throw new AppError(
          "LAUNCH_INVALID_RESPONSE",
          "Missing gang.fun graduation state",
        );
      const progress = number(r.progressPct);
      const stage = r.graduated
        ? "MIGRATED"
        : progress !== null && progress >= 80
          ? "FINALIZING"
          : "NEW";
      const price = v2
        ? number(r.priceUsd)
        : number(r.priceBnb) !== null && number(r.bnbUsd) !== null
          ? Number(r.priceBnb) * Number(r.bnbUsd)
          : null;
      return [
        {
          ...token(v2 ? "GANG_V2" : "GANG", stage, a),
          symbol: String(r.symbol ?? ""),
          name: String(r.name ?? ""),
          priceUsd:
            price === null ? null : v2 ? String(r.priceUsd) : String(price),
          volumeUsd: number(r.volume24hUsd),
          marketCapUsd: number(r.fdvUsd),
          holders: number(r.holders),
          progress,
          imageUrl: image(r.logoUrl ?? r.logo, "https://gang.fun"),
          platform: v2 ? "gang.fun V2" : "gang.fun",
        },
      ];
    });
  }
}
