import { Injectable } from "@nestjs/common";
import { Prisma, AgentRun, MintCandidate } from "@prisma/client";
import { AgentLeaseRepository } from "./lease.repository";
import { PrismaService } from "../../prisma/prisma.service";
import { AppError } from "../../common/http";
import { safeJson, safeError } from "../../common/safe-data";
@Injectable()
export class AgentStore {
  constructor(
    private readonly db: PrismaService,
    private readonly leases: AgentLeaseRepository,
  ) {}
  withLease<T>(key: string, fn: () => Promise<T>) {
    return this.leases.withLease(key, fn);
  }
  runs(cursor?: string, limit = 20, walletScope?: string) {
    return this.db.agentRun.findMany({
      where: { walletScope },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        kind: true,
        status: true,
        trigger: true,
        summary: true,
        errorCode: true,
        errorMessage: true,
        candidateId: true,
        startedAt: true,
        finishedAt: true,
      },
    });
  }
  async run(id: string) {
    const run = await this.db.agentRun.findUnique({
      where: { id },
      include: {
        actions: { orderBy: { seq: "asc" } },
        candidate: true,
        confirmations: true,
      },
    });
    if (!run) throw new AppError("RUN_NOT_FOUND", "Agent run not found", 404);
    return run;
  }
  createRun(
    kind: string,
    trigger = "USER",
    candidateId?: string,
    walletScope?: string,
  ) {
    return this.db.agentRun.create({
      data: { kind, trigger, candidateId, walletScope },
    });
  }
  updateRun(id: string, data: Prisma.AgentRunUpdateInput) {
    return this.db.agentRun.update({ where: { id }, data });
  }
  async action(
    runId: string,
    name: string,
    decision: string,
    detail: unknown = {},
    extras: {
      requestId?: string;
      txHash?: string;
      riskSummary?: string;
      durationMs?: number;
    } = {},
  ) {
    return this.db.$transaction(async (tx) => {
      const run = await tx.agentRun.update({
        where: { id: runId },
        data: { actionSeq: { increment: 1 } },
      });
      return tx.agentAction.create({
        data: {
          runId,
          seq: run.actionSeq,
          name,
          decision,
          detailJson: safeJson(detail) as Prisma.InputJsonValue,
          ...extras,
        },
      });
    });
  }
  async finish(id: string, status: string, summary: string, error?: unknown) {
    const e = error ? safeError(error) : null;
    await this.updateRun(id, {
      status,
      summary,
      finishedAt: new Date(),
      ...(e ? { errorCode: e.code, errorMessage: e.message } : {}),
    });
    await this.notify(id, summary);
  }
  notify(runId: string, message: string) {
    return this.db.agentNotification.create({
      data: { runId, message: message.slice(0, 500) },
    });
  }
  async notifications(walletScope: string) {
    const runs = await this.db.agentRun.findMany({
      where: { walletScope },
      select: { id: true },
    });
    return this.db.agentNotification.findMany({
      where: { runId: { in: runs.map((r) => r.id) } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
  async readNotification(id: string, walletScope?: string) {
    const runs = await this.db.agentRun.findMany({
      where: { walletScope },
      select: { id: true },
    });
    await this.db.agentNotification.updateMany({
      where: { id, runId: { in: runs.map((r) => r.id) } },
      data: { readAt: new Date() },
    });
    return { read: true };
  }
  candidates() {
    return this.db.mintCandidate.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }
  async candidate(id: string) {
    const c = await this.db.mintCandidate.findUnique({ where: { id } });
    if (!c)
      throw new AppError(
        "CANDIDATE_NOT_FOUND",
        "Mint candidate not found",
        404,
      );
    return c;
  }
  addCandidate(data: Prisma.MintCandidateCreateInput) {
    return this.db.mintCandidate.upsert({
      where: {
        chainId_contractAddress: {
          chainId: String(data.chainId || "56"),
          contractAddress: String(data.contractAddress).toLowerCase(),
        },
      },
      create: {
        ...data,
        contractAddress: String(data.contractAddress).toLowerCase(),
      },
      update: {},
    });
  }
  updateCandidate(id: string, data: Prisma.MintCandidateUpdateInput) {
    return this.db.mintCandidate.update({ where: { id }, data });
  }
  async beginCandidate(
    id: string,
    kind: string,
    allowed = [
      "DISCOVERED",
      "PAID_RESEARCH",
      "FREE_ELIGIBLE",
      "ABORTED",
      "PREVIEW_FAILED",
      "PREVIEW_RISKY",
      "BRIEF_READY",
      "REJECTED_NOT_FREE",
    ],
    walletScope?: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const c = await tx.mintCandidate.updateMany({
        where: { id, status: { in: allowed } },
        data: { status: kind === "RESEARCH" ? "RESEARCHING" : "CLASSIFYING" },
      });
      if (!c.count)
        throw new AppError(
          "CANDIDATE_BUSY",
          "Candidate already processed or in flight",
          409,
        );
      const run = await tx.agentRun.create({
        data: { kind, candidateId: id, walletScope },
      });
      await tx.mintCandidate.update({
        where: { id },
        data: { lastRunId: run.id },
      });
      return run;
    });
  }
  createBrief(data: Prisma.ResearchBriefUncheckedCreateInput) {
    return this.db.researchBrief.create({ data });
  }
  briefs() {
    return this.db.researchBrief.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
  async brief(id: string) {
    const b = await this.db.researchBrief.findUnique({
      where: { id },
      include: { candidate: true },
    });
    if (!b)
      throw new AppError("BRIEF_NOT_FOUND", "Research brief not found", 404);
    return b;
  }
  createConfirmation(data: Prisma.UserSpendConfirmUncheckedCreateInput) {
    return this.db.userSpendConfirm.create({ data });
  }
  async claimExecution(runId: string, confirmationId?: string) {
    return this.db.$transaction(async (tx) => {
      const r = await tx.agentRun.updateMany({
        where: { id: runId, status: "AWAITING_CONFIRMATION" },
        data: { status: "EXECUTING" },
      });
      if (!r.count)
        throw new AppError(
          "CONFIRM_CONSUMED",
          "Run is not executable or already consumed",
          409,
        );
      if (confirmationId) {
        const c = await tx.userSpendConfirm.updateMany({
          where: {
            id: confirmationId,
            runId,
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { consumedAt: new Date() },
        });
        if (!c.count)
          throw new AppError(
            "CONFIRM_CONSUMED",
            "Confirmation expired or consumed",
            409,
          );
      }
    });
  }
  pending() {
    return this.db.agentRun.findMany({
      where: { status: "SUBMITTED" },
      include: { candidate: true, actions: { orderBy: { seq: "desc" } } },
      take: 20,
    });
  }
  async expire() {
    const stale = await this.db.agentRun.findMany({
      where: { status: "AWAITING_CONFIRMATION", expiresAt: { lt: new Date() } },
    });
    for (const r of stale) {
      await this.finish(
        r.id,
        "ABORTED",
        "Preview or quote expired",
        new AppError("PREVIEW_EXPIRED", "Create a new preview", 409),
      );
      if (r.candidateId)
        await this.updateCandidate(r.candidateId, {
          status: r.kind === "PAID_BUY" ? "BRIEF_READY" : "ABORTED",
        });
    }
  }
  async recover() {
    const active = await this.db.agentRun.findMany({
      where: {
        status: { in: ["RUNNING", "EXECUTING", "AWAITING_CONFIRMATION"] },
        NOT: { trigger: "WEBHOOK" },
      },
    });
    for (const run of active) {
      const unknown = run.status === "EXECUTING";
      await this.finish(
        run.id,
        unknown ? "UNKNOWN" : "FAILED",
        unknown
          ? "Execution interrupted; reconcile before retry"
          : "Run interrupted; preview invalidated",
        new AppError(
          "PROCESS_RESTARTED",
          "Process restarted; no automatic replay",
          409,
        ),
      );
      if (run.candidateId)
        await this.updateCandidate(run.candidateId, {
          status: unknown ? "EXECUTION_UNKNOWN" : "ABORTED",
        });
    }
  }
}
export type RunRecord = AgentRun;
export type CandidateRecord = MintCandidate;
