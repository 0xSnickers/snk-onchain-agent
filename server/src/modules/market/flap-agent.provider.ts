import { Injectable } from "@nestjs/common";
import { Interface } from "ethers";
import { NetworkService } from "../../common/network.service";
import { AppError } from "../../common/http";
import { address, token } from "./launch-normalize";
const READER = "0x18Aa6C93f1887a243fdc348C9A77F5136555174a";
const ABI = new Interface([
  "function marketPage(uint256 cursor,uint256 limit) view returns (address[] marketAddresses,uint256 nextCursor,uint256 total)",
  "function marketCards(address[] markets) view returns (tuple(address market,address quoteToken,string name,string symbol,string meta,address predictedToken,address token,address pair,uint8 phase,uint256 poolRaw,uint256 capRaw,uint256 progressBps,uint256 buyCount,uint256 sellCount,uint256 curveH,uint256 curveK)[] cards)",
]);
@Injectable()
export class FlapAgentProvider {
  constructor(private readonly network: NetworkService) {}
  private async rpc<T>(
    method: string,
    params: unknown[],
    signal: AbortSignal,
  ): Promise<T> {
    const r = await this.network.json<{ result?: T; error?: unknown }>(
      process.env.MARKET_BSC_RPC_URL ||
        process.env.BSC_RPC_URL ||
        "https://bsc-rpc.publicnode.com",
      { jsonrpc: "2.0", id: 1, method, params },
      {},
      signal,
    );
    if (r.error || r.result === undefined)
      throw new AppError("LAUNCH_RPC_ERROR", "Flap Agent on-chain read failed");
    return r.result;
  }
  private async read(
    method: string,
    args: unknown[],
    block: string,
    signal: AbortSignal,
  ) {
    const data = await this.rpc<string>(
      "eth_call",
      [{ to: READER, data: ABI.encodeFunctionData(method, args) }, block],
      signal,
    );
    try {
      return ABI.decodeFunctionResult(method, data);
    } catch {
      throw new AppError(
        "LAUNCH_INVALID_RESPONSE",
        "Invalid Flap Agent reader response",
      );
    }
  }
  async list() {
    const signal = AbortSignal.timeout(25000);
    if ((await this.rpc<string>("eth_chainId", [], signal)) !== "0x38")
      throw new AppError(
        "LAUNCH_CHAIN_MISMATCH",
        "Market RPC is not BNB Smart Chain",
      );
    const block = await this.rpc<string>("eth_blockNumber", [], signal);
    const first = await this.read("marketPage", [0, 1], block, signal);
    const total = Number(first.total);
    if (!Number.isSafeInteger(total) || total < 0)
      throw new AppError(
        "LAUNCH_INVALID_RESPONSE",
        "Invalid Flap market count",
      );
    // Bounded latest 64 markets, all from the same block. Never label this as full history.
    const starts = Array.from(
      { length: Math.ceil(Math.min(total, 64) / 16) },
      (_, i) => Math.max(0, total - 64) + i * 16,
    );
    const pages = await Promise.all(
      starts.map(async (start) => {
        const page = await this.read(
          "marketPage",
          [start, Math.min(16, total - start)],
          block,
          signal,
        );
        if (!page.marketAddresses.length) return [];
        const cards = await this.read(
          "marketCards",
          [[...page.marketAddresses]],
          block,
          signal,
        );
        return [...cards.cards];
      }),
    );
    return pages
      .flat()
      .reverse()
      .map((c) => {
        const phase = Number(c.phase);
        if (![1, 2, 3].includes(phase))
          throw new AppError("LAUNCH_INVALID_RESPONSE", "Unknown Flap phase");
        const marketAddress = address(c.market);
        const actual = address(c.token);
        const a = actual || address(c.predictedToken);
        if (!a || !marketAddress)
          throw new AppError(
            "LAUNCH_INVALID_RESPONSE",
            "Invalid Flap market identity",
          );
        const progress = Number(c.progressBps) / 100;
        const stage =
          phase === 3
            ? "MIGRATED"
            : phase === 2 || progress >= 80
              ? "FINALIZING"
              : "NEW";
        return {
          ...token("FLAP_AGENT", stage, a),
          symbol: String(c.symbol),
          name: String(c.name),
          marketAddress,
          tokenDeployed: !!actual,
          progress,
          platform: "Flap Agent",
          url: actual
            ? `https://bscscan.com/token/${actual}`
            : `https://bscscan.com/address/${marketAddress}`,
        };
      });
  }
}
