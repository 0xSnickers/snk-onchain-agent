import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { keccak_256 } from "@noble/hashes/sha3";
import { NetworkService } from "../../common/network.service";
import { AppError } from "../../common/http";
import { agentEnv } from "../../config/agent-env";
export interface FreeProof {
  chainId: string;
  from: string;
  to: string;
  inputData: string;
  value: string;
  block: string;
  codeHash: string;
  gasRequiredWei: string;
  priceFields: { method: string; value: string }[];
}
@Injectable()
export class RpcService {
  constructor(private readonly network: NetworkService) {}
  async call<T>(method: string, params: unknown[]): Promise<T> {
    if (!agentEnv.rpc)
      throw new AppError(
        "RPC_NOT_CONFIGURED",
        "Set BSC_RPC_URL for on-chain validation",
        409,
      );
    const r = await this.network.json<{
      result?: T;
      error?: { code: number; message: string };
    }>(agentEnv.rpc, { jsonrpc: "2.0", id: 1, method, params });
    if (r.error)
      throw new AppError(
        /revert/i.test(r.error.message) || r.error.code === 3
          ? "RPC_REVERT"
          : "RPC_ERROR",
        "On-chain read failed",
      );
    if (r.result === undefined)
      throw new AppError("RPC_ERROR", "RPC response missing result");
    return r.result;
  }
  async proveFree(
    from: string,
    to: string,
    inputData: string,
  ): Promise<FreeProof> {
    if ((await this.call<string>("eth_chainId", [])) !== "0x38")
      throw new AppError(
        "RPC_CHAIN_MISMATCH",
        "RPC is not BNB Smart Chain",
        409,
      );
    const block = await this.call<string>("eth_blockNumber", []);
    const code = await this.call<string>("eth_getCode", [to, block]);
    if (!/^0x[0-9a-f]+$/i.test(code) || code === "0x0")
      throw new AppError(
        "NOT_A_CONTRACT",
        "Target has no contract bytecode",
        409,
      );
    const priceFields: FreeProof["priceFields"] = [];
    for (const method of [
      "mintPrice()",
      "price()",
      "MINT_PRICE()",
      "cost()",
      "mintFee()",
    ]) {
      const selector =
        "0x" +
        Buffer.from(keccak_256(new TextEncoder().encode(method)))
          .toString("hex")
          .slice(0, 8);
      try {
        const price = await this.call<string>("eth_call", [
          { from, to, data: selector, value: "0x0" },
          block,
        ]);
        if (/^0x[0-9a-f]{64}$/i.test(price))
          priceFields.push({ method, value: BigInt(price).toString() });
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "RPC_REVERT")
          throw error;
      }
    }
    if (priceFields.some((p) => BigInt(p.value) > 0n))
      throw new AppError(
        "NOT_FREE",
        "On-chain mint price is greater than zero",
        409,
      );
    if (!priceFields.length)
      throw new AppError(
        "PRICE_UNVERIFIED",
        "No readable on-chain price field; research only",
        409,
      );
    const tx = { from, to, data: inputData, value: "0x0" };
    await this.call("eth_call", [tx, block]);
    let acceptsPaid = false;
    try {
      await this.call("eth_call", [{ ...tx, value: "0x1" }, block]);
      acceptsPaid = true;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "RPC_REVERT")
        throw error;
    }
    if (acceptsPaid)
      throw new AppError(
        "PRICE_AMBIGUOUS",
        "Contract also accepts nonzero value; automatic mint rejected",
        409,
      );
    const [gas, price, balance] = await Promise.all([
      this.call<string>("eth_estimateGas", [tx]),
      this.call<string>("eth_gasPrice", []),
      this.call<string>("eth_getBalance", [from, block]),
    ]);
    const cost = (BigInt(gas) * BigInt(price) * 125n) / 100n;
    if (cost > BigInt(agentEnv.maxGasWei))
      throw new AppError(
        "GAS_LIMIT_EXCEEDED",
        "Estimated gas exceeds configured budget",
        409,
      );
    if (BigInt(balance) < cost)
      throw new AppError(
        "ABORTED_INSUFFICIENT_GAS",
        "Wallet native balance is insufficient for gas",
        409,
      );
    return {
      chainId: "56",
      from,
      to,
      inputData,
      value: "0",
      block,
      codeHash: createHash("sha256").update(code).digest("hex"),
      gasRequiredWei: cost.toString(),
      priceFields,
    };
  }
  async receipt(txHash: string) {
    const receipt = await this.call<{
      status: string;
      blockNumber: string;
      blockHash: string;
    } | null>("eth_getTransactionReceipt", [txHash]);
    if (!receipt) return null;
    const latest = BigInt(await this.call<string>("eth_blockNumber", []));
    const block = await this.call<{ hash: string }>("eth_getBlockByNumber", [
      receipt.blockNumber,
      false,
    ]);
    if (
      block.hash !== receipt.blockHash ||
      latest - BigInt(receipt.blockNumber) < 1n
    )
      return null;
    return receipt;
  }
}
