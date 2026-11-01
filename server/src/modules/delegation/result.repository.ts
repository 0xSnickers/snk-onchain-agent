import { CandidateOutbox, MintCandidate } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AppError } from "../../common/http";
import { ResultInput } from "./delegation.dto";
export function recordDelegatedResult(
  db: PrismaService,
  row: CandidateOutbox,
  c: MintCandidate,
  input: ResultInput,
  txTime: Date | null,
) {
  const id = row.id;
  const txHash = input.txHash?.toLowerCase();
  return db.$transaction(async (db) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(882911)`;
    const current = await db.candidateOutbox.findUniqueOrThrow({
      where: { id },
    });
    if (["SUCCEEDED", "FAILED"].includes(current.status)) {
      if (
        current.status !== input.status ||
        current.txHash !== (txHash || null)
      )
        throw new AppError(
          "RESULT_CONFLICT",
          "Terminal result already recorded",
          409,
        );
      return current;
    }
    if (current.txHash && txHash !== current.txHash)
      throw new AppError("RESULT_CONFLICT", "Transaction already bound", 409);
    if (
      current.status === "UNKNOWN" &&
      !["SUCCEEDED", "FAILED", "UNKNOWN"].includes(input.status)
    )
      throw new AppError(
        "RESULT_CONFLICT",
        "UNKNOWN requires reconciliation, never resubmission",
        409,
      );
    const terminal = ["SUCCEEDED", "FAILED", "UNKNOWN"].includes(input.status);
    await db.agentRun.update({
      where: { id: row.runId! },
      data: {
        status: input.status,
        summary: `Grok Bot ${row.executorId}: ${input.status}`,
        finishedAt: terminal ? new Date() : null,
        actionSeq: { increment: 1 },
      },
    });
    const run = await db.agentRun.findUniqueOrThrow({
      where: { id: row.runId! },
    });
    await db.agentAction.create({
      data: {
        runId: run.id,
        seq: run.actionSeq,
        name: "delegated.result",
        decision: input.status === "SUCCEEDED" ? "ALLOW" : "INFO",
        txHash,
        detailJson: {
          executorId: row.executorId,
          status: input.status,
          errorCode: input.errorCode || null,
          previewRequestId: input.previewRequestId || null,
          previewClean: input.previewClean ?? null,
          priceWei: input.priceWei ?? null,
          holders: input.holders ?? null,
          orderId: input.orderId || null,
          orderStatus: input.orderStatus || null,
          evidenceSource: "EXECUTOR_REPORTED",
          source: "GROK_BOT",
        },
      },
    });
    if (terminal)
      await db.agentNotification.create({
        data: { runId: run.id, message: run.summary },
      });
    if (input.status === "SUCCEEDED" && row.kind !== "PAID_RESEARCH") {
      const duplicate = await db.walletActivity.findUnique({
        where: {
          walletScope_chainId_txHash: {
            walletScope: row.walletScope,
            chainId: "56",
            txHash: txHash!,
          },
        },
      });
      if (duplicate)
        throw new AppError(
          "TX_ALREADY_IMPORTED",
          "Transaction already belongs to an imported operation",
          409,
        );
      await db.walletActivity.create({
        data: {
          walletScope: row.walletScope,
          walletAddress: row.walletScope.slice(4),
          chainId: "56",
          txHash: txHash!,
          type: row.kind === "FREE_MINT" ? "MINT" : "TRADE",
          providerType: "DELEGATED",
          status: "SUCCESS",
          txTime,
          movements: [],
          source: "GROK_BOT_LEDGER",
        },
      });
      await db.mintCandidate.update({
        where: { id: c.id },
        data: {
          status: row.kind === "FREE_MINT" ? "MINTED" : "BOUGHT",
          lastRunId: run.id,
        },
      });
    }
    if (
      ["UNKNOWN", "FAILED"].includes(input.status) &&
      row.kind !== "PAID_RESEARCH"
    )
      await db.mintCandidate.update({
        where: { id: c.id },
        data: {
          status:
            input.status === "UNKNOWN"
              ? "EXECUTION_UNKNOWN"
              : row.kind === "FREE_MINT"
                ? "MINT_FAILED"
                : "BUY_FAILED",
          lastRunId: run.id,
        },
      });
    return db.candidateOutbox.update({
      where: { id },
      data: { status: input.status, txHash },
    });
  });
}
