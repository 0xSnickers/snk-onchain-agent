import { Injectable } from "@nestjs/common";
import { AppError } from "../../common/http";
import { NetworkService } from "../../common/network.service";
import { holderMeta, readHoldersSnapshot, type HolderConfidence } from "./holders-snapshot";
import { LedgerContract, readLedger } from "./wallet-delegation";

const RPC = "https://bsc-dataseed.binance.org";
const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
const BALANCE_OF = "0x70a08231";
const DECIMALS = "0x313ce567";

export interface HoldingAsset {
  kind: "NATIVE" | "TOKEN" | "NFT";
  symbol: string;
  name: string;
  contractAddress: string | null;
  balance: string;
  decimals: number | null;
  valueUsd: string | null;
  holders: number | null;
  holdersConfidence: HolderConfidence | null;
}
@Injectable()
export class HoldingsService {
  private cache?: { until: number; value: unknown };
  constructor(private readonly network: NetworkService) {}
  async current() {
    if (this.cache && this.cache.until > Date.now()) return this.cache.value;
    const ledger = readLedger();
    const value = await this.collect(ledger.address, ledger.scope, ledger.contracts);
    this.cache = { until: Date.now() + 20000, value };
    return value;
  }
  async collect(address: string, scope: string, contracts: LedgerContract[]) {
    const chainId = await this.rpc<string>("eth_chainId", []);
    if (chainId !== "0x38")
      throw new AppError("RPC_CHAIN_MISMATCH", "Balance RPC is not BNB Smart Chain", 502);
    const native = await this.rpc<string>("eth_getBalance", [address, "latest"]);
    const bnb = formatUnits(hex(native), 18);
    const price = await this.bnbPrice();
    const assets: HoldingAsset[] = [
      {
        kind: "NATIVE",
        symbol: "BNB",
        name: "BNB",
        contractAddress: null,
        balance: bnb,
        decimals: 18,
        valueUsd: price ? mul(bnb, price) : null,
        holders: null,
        holdersConfidence: null,
      },
    ];
    const failures: LedgerContract[] = [];
    const rows = await Promise.all(
      contracts.map(async (contract) => {
        try {
          return await this.token(address, contract);
        } catch {
          failures.push(contract);
          return null;
        }
      }),
    );
    for (const row of rows) if (row) assets.push(row);
    const snapshot = readHoldersSnapshot();
    for (const asset of assets) {
      const meta = holderMeta(snapshot, asset.contractAddress);
      asset.holders = meta.holders;
      asset.holdersConfidence = meta.holdersConfidence;
    }
    return {
      address,
      scope,
      chainId: "56",
      source: "BSC_RPC",
      fetchedAt: new Date().toISOString(),
      bnbPriceUsd: price,
      holdersSnapshot: snapshot ? { fetchedAt: snapshot.fetchedAt } : null,
      failures: failures.map((contract) => ({
        contractAddress: contract.address,
        name: contract.name,
        ...holderMeta(snapshot, contract.address),
      })),
      assets,
    };
  }
  private async token(holder: string, contract: LedgerContract): Promise<HoldingAsset | null> {
    const raw = hex(
      await this.rpc<string>("eth_call", [
        { to: contract.address, data: BALANCE_OF + holder.slice(2).padStart(64, "0") },
        "latest",
      ]),
    );
    if (raw === 0n) return null;
    if (raw <= 1_000_000n)
      return {
        kind: "NFT",
        symbol: contract.name,
        name: contract.name,
        contractAddress: contract.address,
        balance: raw.toString(),
        decimals: 0,
        valueUsd: null,
        holders: null,
        holdersConfidence: null,
      };
    const decimals = Number(
      hex(await this.rpc<string>("eth_call", [{ to: contract.address, data: DECIMALS }, "latest"])),
    );
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36)
      throw new AppError("RPC_ERROR", "Token decimals are invalid");
    return {
      kind: "TOKEN",
      symbol: contract.name,
      name: contract.name,
      contractAddress: contract.address,
      balance: formatUnits(raw, decimals),
      decimals,
      valueUsd: null,
      holders: null,
      holdersConfidence: null,
    };
  }
  private async bnbPrice() {
    try {
      const body = await this.network.json<{ pairs?: { chainId?: string; priceUsd?: string }[] }>(
        `https://api.dexscreener.com/latest/dex/tokens/${WBNB}`,
      );
      const price = body.pairs?.find((pair) => pair.chainId === "bsc")?.priceUsd;
      return price && Number(price) > 0 ? price : null;
    } catch {
      return null;
    }
  }
  private rpc<T>(method: string, params: unknown[]) {
    return this.network
      .json<{ result?: T; error?: { message?: string } }>(RPC, {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      })
      .then((body) => {
        if (body.error || body.result === undefined)
          throw new AppError("ASSETS_UNAVAILABLE", body.error?.message || "Balance RPC failed", 502);
        return body.result;
      });
  }
}
function hex(value: string) {
  if (!/^0x[0-9a-f]*$/i.test(value))
    throw new AppError("ASSETS_UNAVAILABLE", "Balance RPC returned a non-hex value", 502);
  return value === "0x" ? 0n : BigInt(value);
}
function formatUnits(raw: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
function mul(amount: string, price: string) {
  const [aw, af = ""] = amount.split(".");
  const [pw, pf = ""] = price.split(".");
  const scale = 8;
  const a = BigInt((aw + af).padEnd(aw.length + scale, "0").slice(0, aw.length + scale));
  const p = BigInt((pw + pf).padEnd(pw.length + scale, "0").slice(0, pw.length + scale));
  const product = a * p;
  const text = product.toString().padStart(scale * 2 + 1, "0");
  const whole = text.slice(0, -scale * 2);
  const fraction = text.slice(-scale * 2, -scale).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
