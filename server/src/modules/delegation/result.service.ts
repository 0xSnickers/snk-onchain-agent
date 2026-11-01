import { verifyResult } from "./result-evidence";
import { Injectable } from "@nestjs/common";
import { AppError } from "../../common/http";
import { RpcService } from "../execution/rpc.service";
import { AgentStore } from "../agent-runs/agent.store";
import { DelegationRepository } from "./delegation.repository";
import { ResultInput } from "./delegation.dto";
import { appendLedger } from "./ledger-writer";
@Injectable()
export class DelegatedResultService {
  constructor(
    private readonly repo: DelegationRepository,
    private readonly rpc: RpcService,
    private readonly store: AgentStore,
  ) {}
  async result(id: string, input: ResultInput) {
    const row = await this.repo.find(id);
    if (
      !row ||
      row.walletScope !== input.walletScope ||
      row.executorId !== input.executorId ||
      row.claimToken !== input.claimToken ||
      !row.runId
    )
      throw new AppError(
        "OUTBOX_NOT_FOUND",
        "No claimed task for this wallet",
        404,
      );
    const txHash = input.txHash?.toLowerCase();
    if (row.txHash && txHash !== row.txHash)
      throw new AppError(
        "RESULT_CONFLICT",
        "Cannot replace a submitted transaction",
        409,
      );
    if (
      ["SUCCEEDED", "FAILED"].includes(row.status) &&
      (input.status !== row.status || row.txHash !== (txHash || null))
    )
      throw new AppError(
        "RESULT_CONFLICT",
        "Terminal result cannot be overwritten",
        409,
      );
    const c = await this.store.candidate(row.candidateId);
    if (
      ["SUBMITTED", "SUCCEEDED"].includes(input.status) &&
      row.kind !== "PAID_RESEARCH" &&
      !txHash
    )
      throw new AppError(
        "TX_REQUIRED",
        "Submitted or successful execution requires a transaction hash",
        400,
      );
    if (
      row.kind === "PAID_RESEARCH" &&
      (txHash || input.status === "SUBMITTED")
    )
      throw new AppError(
        "UNAUTHORIZED_SPEND",
        "Research task does not authorize any transaction",
        409,
      );
    const txTime = await verifyResult(row, c, input, this.rpc);
    const result = await this.repo.recordResult(row, c, input, txTime);
    if (result.status === "SUCCEEDED" && row.kind === "FREE_MINT") {
      try {
        const activity = await this.repo.activity(
          row.walletScope,
          result.txHash!,
        );
        await this.store.withLease("ledger-file", () =>
          appendLedger({
            txHash: result.txHash,
            contractAddress: c.contractAddress,
            walletScope: row.walletScope,
            walletAddress: row.walletScope.slice(4),
            chainId: "56",
            mintedAt: activity.txTime!.toISOString(),
            previewClean: true,
            priceWei: "0",
            holdersSnapshot: input.holders,
            batchId: row.id,
            name: c.name,
            symbol: c.symbol,
            source: "GROK_BOT_LEDGER",
          }),
        );
      } catch {
        await this.store.notify(
          row.runId,
          "LEDGER_SYNC_FAILED: DB success retained; resend the same result to retry file sync",
        );
        throw new AppError(
          "LEDGER_SYNC_FAILED",
          "Database success retained; retry identical result to synchronize the ledger file",
          502,
        );
      }
    }
    return result;
  }
}
