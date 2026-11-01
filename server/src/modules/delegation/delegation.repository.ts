import { ExecutorRepository, assertRole } from "./executor.repository";
import { Injectable } from "@nestjs/common";
import { recordDelegatedResult } from "./result.repository";
import { CandidateOutbox, MintCandidate, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AppError } from "../../common/http";
import {
  SessionInput,
  ClaimInput,
  ResultInput,
  ExecutorCreateInput,
  ExecutorUpdateInput,
} from "./delegation.dto";
import { assertOnline, heartbeatMs } from "./session-policy";
export { assertOnline } from "./session-policy";
@Injectable()
export class DelegationRepository {
  constructor(private readonly db: PrismaService) {}
  find(id: string) {
    return this.db.candidateOutbox.findUnique({ where: { id } });
  }
  sessionById(id: string) {
    return this.db.executorSession.findUnique({ where: { id } });
  }
  scans() {
    return this.db.agentRun.findMany({
      where: { kind: "SCAN", walletScope: null },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        summary: true,
        startedAt: true,
        actions: {
          orderBy: { seq: "asc" },
          select: { name: true, decision: true, detailJson: true },
        },
      },
    });
  }
  activeCandidates() {
    return this.db.candidateOutbox.findMany({
      where: { status: { not: "EXPIRED" } },
      select: { candidateId: true },
    });
  }
  activity(walletScope: string, txHash: string) {
    return this.db.walletActivity.findUniqueOrThrow({
      where: {
        walletScope_chainId_txHash: { walletScope, chainId: "56", txHash },
      },
    });
  }
  recordResult(
    row: CandidateOutbox,
    c: MintCandidate,
    input: ResultInput,
    time: Date | null,
  ) {
    return recordDelegatedResult(this.db, row, c, input, time);
  }
  markQueued(id: string, free: boolean) {
    return this.db.mintCandidate.updateMany({
      where: {
        id,
        status: { in: ["DISCOVERED", "FREE_ELIGIBLE", "PAID_RESEARCH"] },
      },
      data: { status: free ? "FREE_ELIGIBLE" : "PAID_RESEARCH" },
    });
  }
  sessions() {
    return this.db.executorSession.findMany({ orderBy: { id: "asc" } });
  }
  session(id: string, input: SessionInput) {
    return new ExecutorRepository(this.db).heartbeat(id, input);
  }
  createExecutor(input: ExecutorCreateInput) {
    return new ExecutorRepository(this.db).create(input);
  }
  updateExecutor(id: string, input: ExecutorUpdateInput) {
    return new ExecutorRepository(this.db).update(id, input);
  }
  selectExecutor(kind: string, id?: string, scope?: string) {
    return new ExecutorRepository(this.db).select(kind, id, scope);
  }
  queued(candidateId: string, kind: string) {
    return this.db.candidateOutbox.findFirst({
      where: { candidateId, kind, status: { not: "EXPIRED" } },
      orderBy: { createdAt: "asc" },
    });
  }
  list(executorId?: string) {
    return this.db.candidateOutbox.findMany({
      where: { executorId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async enqueue(data: Prisma.CandidateOutboxCreateInput) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(882910)`;
      const session = await tx.executorSession.findUnique({
        where: { id: data.executorId },
      });
      if (!session || session.walletScope !== data.walletScope)
        throw new AppError("WALLET_CHANGED", "Executor scope changed", 409);
      assertRole(session, data.kind);
      const row = await tx.candidateOutbox.upsert({
        where: {
          candidateId_kind_walletScope: {
            candidateId: data.candidateId,
            kind: data.kind,
            walletScope: data.walletScope,
          },
        },
        create: data,
        update: {},
      });
      if (row.status === "EXPIRED" && !row.claimToken) {
        await tx.candidateOutbox.updateMany({
          where: { id: row.id, status: "EXPIRED", claimToken: null },
          data: {
            status: "PENDING",
            payload: data.payload,
            confirmation: data.confirmation,
            expiresAt: data.expiresAt,
          },
        });
        return tx.candidateOutbox.findUniqueOrThrow({
          where: { id: row.id },
        });
      }
      return row;
    });
  }
  async claim(id: string, input: ClaimInput) {
    return this.db.$transaction(async (tx) => {
      // The same lock serializes heartbeat/pause and claims.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(882910)`;
      const session = await tx.executorSession.findUnique({
        where: { id: input.executorId },
      });
      assertOnline(session);
      if (session!.walletScope !== input.walletScope)
        throw new AppError("WALLET_CHANGED", "Executor scope mismatch", 409);
      const row = await tx.candidateOutbox.findUnique({ where: { id } });
      if (
        !row ||
        row.executorId !== input.executorId ||
        row.walletScope !== input.walletScope
      )
        throw new AppError(
          "OUTBOX_NOT_FOUND",
          "No candidate for this executor scope",
          404,
        );
      assertRole(session!, row.kind);
      if (row.kind === "PAID_BUY" && !row.confirmation)
        throw new AppError(
          "CONFIRM_REQUIRED",
          "Paid buy requires a recorded confirmation",
          409,
        );
      const candidate = await tx.mintCandidate.findUniqueOrThrow({
        where: { id: row.candidateId },
      });
      if (
        ["MINTED", "BOUGHT", "EXECUTING", "EXECUTION_UNKNOWN"].includes(
          candidate.status,
        )
      )
        throw new AppError(
          "CANDIDATE_PROCESSED",
          "Candidate completed or in flight",
          409,
        );
      const token = randomUUID();
      const claimed = await tx.candidateOutbox.updateMany({
        where: { id, status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "CLAIMED", claimToken: token, claimedAt: new Date() },
      });
      if (!claimed.count)
        throw new AppError(
          "OUTBOX_CONSUMED",
          "Candidate expired or already consumed; never replay unknown results",
          409,
        );
      const run = await tx.agentRun.create({
        data: {
          kind: row.kind,
          status: "EXECUTING",
          walletScope: row.walletScope,
          candidateId: row.candidateId,
          summary: "Delegated to Grok Bot",
          trigger: "WEBHOOK",
        },
      });
      await tx.candidateOutbox.update({
        where: { id },
        data: { runId: run.id },
      });
      if (row.kind !== "PAID_RESEARCH")
        await tx.mintCandidate.update({
          where: { id: row.candidateId },
          data: { status: "EXECUTING", lastRunId: run.id },
        });
      return { ...row, status: "CLAIMED", runId: run.id, claimToken: token };
    });
  }
  async expire() {
    const stale = await this.db.executorSession.findMany({
      where: {
        state: "CONNECTED",
        heartbeatAt: { lt: new Date(Date.now() - heartbeatMs) },
      },
    });
    for (const s of stale)
      await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(882910)`;
        const changed = await tx.executorSession.updateMany({
          where: { id: s.id, state: "CONNECTED", heartbeatAt: s.heartbeatAt },
          data: { state: "UNCONNECTED" },
        });
        if (changed.count) {
          const run = await tx.agentRun.create({
            data: {
              kind: "EXECUTOR_STATUS",
              walletScope: s.walletScope,
              status: "ABORTED",
              finishedAt: new Date(),
              summary: `${s.id} heartbeat expired; execution paused; reconnect in Grok Bot`,
            },
          });
          await tx.agentNotification.create({
            data: { runId: run.id, message: run.summary },
          });
        }
      });
    const now = new Date();
    await this.db.candidateOutbox.updateMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    });
    // Claimed or submitted work is never put back in the pending queue.
    const rows = await this.db.candidateOutbox.findMany({
      where: {
        status: { in: ["CLAIMED", "SUBMITTED"] },
        updatedAt: { lt: new Date(Date.now() - 1800000) },
      },
    });
    for (const row of rows)
      await this.db.$transaction(async (tx) => {
        const changed = await tx.candidateOutbox.updateMany({
          where: { id: row.id, status: row.status, updatedAt: row.updatedAt },
          data: { status: "UNKNOWN" },
        });
        if (changed.count && row.runId) {
          await tx.agentRun.update({
            where: { id: row.runId },
            data: {
              status: "UNKNOWN",
              finishedAt: now,
              summary: "Executor timed out; do not replay",
            },
          });
          if (row.kind !== "PAID_RESEARCH")
            await tx.mintCandidate.update({
              where: { id: row.candidateId },
              data: { status: "EXECUTION_UNKNOWN" },
            });
          await tx.agentNotification.create({
            data: {
              runId: row.runId,
              message:
                "Executor timed out; reconcile UNKNOWN result manually; no automatic replay",
            },
          });
        }
      });
  }
}
