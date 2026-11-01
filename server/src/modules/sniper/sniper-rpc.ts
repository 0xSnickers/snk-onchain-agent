import { Injectable } from "@nestjs/common";
import { NetworkService } from "../../common/network.service";
import { AppError } from "../../common/http";
import { bytecodeHasAgentRegistry } from "./sniper-policy";

@Injectable()
export class SniperRpc {
  constructor(private readonly network: NetworkService) {}

  async registryPresent(address: string): Promise<boolean | null> {
    const url = rpcUrl();
    if (!url) return null;
    const chain = await this.call<string>(url, "eth_chainId", []);
    if (typeof chain !== "string" || !/^0x[0-9a-f]+$/i.test(chain) || BigInt(chain) !== 56n) {
      throw new AppError("RPC_CHAIN_MISMATCH", "Sniper RPC is not BNB Smart Chain", 409);
    }
    const code = await this.call<string>(url, "eth_getCode", [address, "latest"]);
    if (typeof code !== "string" || !code.startsWith("0x")) {
      throw new AppError("RPC_ERROR", "Sniper RPC returned no bytecode", 502);
    }
    return bytecodeHasAgentRegistry(code);
  }

  private async call<T>(url: string, method: string, params: unknown[]) {
    const body = await this.network.json<{ result?: T; error?: { message?: string } }>(url, {
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    });
    if (!body || body.error || body.result === undefined) {
      throw new AppError("RPC_ERROR", "Sniper RPC read failed", 502);
    }
    return body.result;
  }
}

function rpcUrl() {
  const raw =
    process.env.SNIPER_BSC_RPC_URL || process.env.MARKET_BSC_RPC_URL || process.env.BSC_RPC_URL || "";
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AppError("RPC_NOT_CONFIGURED", "Sniper RPC URL is invalid", 409);
  }
  const loopback =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !loopback) {
    throw new AppError("RPC_NOT_CONFIGURED", "Sniper RPC must be HTTPS or loopback", 409);
  }
  return parsed.href;
}
