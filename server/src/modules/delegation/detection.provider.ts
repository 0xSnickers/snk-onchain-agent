import { Injectable } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import { Interface } from "ethers";
import { AppError } from "../../common/http";
import { RpcService } from "../execution/rpc.service";
import { holderMeta, readHoldersSnapshot } from "../wallet/holders-snapshot";
import { CandidateInput } from "../mint-monitor/candidate.dto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
@Injectable()
export class FairMintProvider {
  constructor(private readonly rpc: RpcService) {}
  async discover(): Promise<CandidateInput[]> {
    const path = process.env.EXTERNAL_FAIR_MINT_FILE;
    if (!path)
      throw new AppError(
        "FAIR_MINT_NOT_CONFIGURED",
        "Set EXTERNAL_FAIR_MINT_FILE to a local fair-mint registry",
        409,
      );
    let doc: { schema?: string; candidates?: unknown[] };
    try {
      doc = JSON.parse(await readFile(path, "utf8"));
    } catch {
      throw new AppError(
        "FAIR_MINT_INVALID",
        "Fair-mint registry missing or invalid JSON",
        409,
      );
    }
    if (
      doc.schema !== "snk-onchain-agent/fair-mints@1" ||
      !Array.isArray(doc.candidates) ||
      doc.candidates.length > 100
    )
      throw new AppError(
        "FAIR_MINT_INVALID",
        "Invalid fair-mint registry schema or count",
        409,
      );
    const rows: CandidateInput[] = [];
    for (const raw of doc.candidates) {
      const row = plainToInstance(CandidateInput, raw);
      if (
        !row ||
        (await validate(row, { whitelist: true, forbidNonWhitelisted: true }))
          .length ||
        row.autoExecute
      )
        throw new AppError(
          "FAIR_MINT_INVALID",
          "Invalid registry candidate; execution permissions are not accepted",
          409,
        );
      rows.push(row);
    }
    return rows;
  }
  async gates(contract: string) {
    if ((await this.rpc.call<string>("eth_chainId", [])) !== "0x38")
      throw new AppError(
        "RPC_CHAIN_MISMATCH",
        "Detection RPC must be BSC",
        409,
      );
    const block = await this.rpc.call<string>("eth_blockNumber", []);
    const code = await this.rpc.call<string>("eth_getCode", [contract, block]);
    if (!/^0x[0-9a-f]+$/i.test(code) || /^0x0*$/i.test(code))
      throw new AppError(
        "NOT_A_CONTRACT",
        "Candidate has no deployed bytecode",
        409,
      );
    const prices: string[] = [];
    for (const method of [
      "mintPrice",
      "price",
      "MINT_PRICE",
      "cost",
      "mintFee",
    ]) {
      const abi = new Interface([
        `function ${method}() view returns (uint256)`,
      ]);
      try {
        const result = await this.rpc.call<string>("eth_call", [
          { to: contract, data: abi.encodeFunctionData(method) },
          block,
        ]);
        if (/^0x[0-9a-f]{64}$/i.test(result))
          prices.push(BigInt(result).toString());
      } catch (e) {
        if (!(e instanceof AppError) || e.code !== "RPC_REVERT") throw e;
      }
    }
    const snapshot = readHoldersSnapshot();
    const holders = holderMeta(snapshot, contract);
    const age = snapshot ? Date.now() - Date.parse(snapshot.fetchedAt) : NaN;
    const holdersVerified =
      Number.isFinite(age) &&
      age >= 0 &&
      age <= 900000 &&
      ["high", "ok"].includes(holders.holdersConfidence || "");
    const priceWei = prices.length
      ? prices.some((p) => BigInt(p) > 0n)
        ? prices.find((p) => BigInt(p) > 0n)!
        : "0"
      : null;
    return {
      priceWei,
      valueWei: "0",
      holders: holders.holders,
      holdersVerified,
      holdersFetchedAt: snapshot?.fetchedAt || null,
      block,
      previewRequired: true,
      agentMustRevalidate: true,
    };
  }
}
