import { Prisma, ExecutorSession } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AppError } from "../../common/http";
import {
  ExecutorCreateInput,
  ExecutorUpdateInput,
  SessionInput,
} from "./delegation.dto";
export function assertRole(session: { role: string }, kind: string) {
  if (session.role !== (kind === "FREE_MINT" ? "FREE_MINT" : "PAID"))
    throw new AppError(
      "EXECUTOR_ROLE",
      "Executor role does not permit this task",
      409,
    );
}
export class ExecutorRepository {
  constructor(private readonly db: PrismaService) {}
  private async uniqueWallet(
    tx: Prisma.TransactionClient,
    id: string,
    walletScope: string,
  ) {
    if (
      await tx.executorSession.findFirst({
        where: { walletScope, NOT: { id } },
      })
    )
      throw new AppError(
        "SESSION_SHARED",
        "Executors must use independent wallets and baw sessions",
        409,
      );
  }
  private async configureDefault(
    tx: Prisma.TransactionClient,
    id: string,
    role: string,
    enabled: boolean,
  ) {
    if (enabled && role === "MONITOR")
      throw new AppError(
        "EXECUTOR_ROLE",
        "Monitor-only wallets cannot be execution defaults",
        409,
      );
    if (enabled)
      await tx.executorSession.updateMany({
        where: { role, NOT: { id } },
        data: { isDefault: false },
      });
  }
  async create(input: ExecutorCreateInput) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(882910)`;
      if (await tx.executorSession.findUnique({ where: { id: input.id } }))
        throw new AppError(
          "EXECUTOR_EXISTS",
          "Executor ID already exists",
          409,
        );
      await this.uniqueWallet(tx, input.id, input.walletScope);
      await this.configureDefault(tx, input.id, input.role, input.isDefault);
      return tx.executorSession.create({
        data: { ...input, label: input.label.trim() || input.id },
      });
    });
  }
  async update(id: string, input: ExecutorUpdateInput) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(882910)`;
      const old = await tx.executorSession.findUnique({ where: { id } });
      if (!old)
        throw new AppError("EXECUTOR_NOT_FOUND", "Executor not found", 404);
      const role = input.role || old.role;
      if (
        role !== old.role &&
        (await tx.candidateOutbox.count({
          where: {
            executorId: id,
            OR: [
              { status: { in: ["CLAIMED", "SUBMITTED", "UNKNOWN"] } },
              { status: "PENDING", expiresAt: { gt: new Date() } },
            ],
          },
        }))
      )
        throw new AppError(
          "EXECUTOR_BUSY",
          "Resolve pending or unknown tasks before changing role",
          409,
        );
      const isDefault = input.isDefault ?? (role === old.role && old.isDefault);
      await this.configureDefault(tx, id, role, isDefault);
      return tx.executorSession.update({
        where: { id },
        data: {
          ...input,
          label:
            input.label === undefined ? old.label : input.label.trim() || id,
          role,
          isDefault,
        },
      });
    });
  }
  async heartbeat(id: string, input: SessionInput) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(882910)`;
      const old = await tx.executorSession.findUnique({ where: { id } });
      if (!old)
        throw new AppError(
          "EXECUTOR_NOT_FOUND",
          "Register the executor and role before reporting heartbeat",
          404,
        );
      if (old.walletScope !== input.walletScope)
        throw new AppError(
          "EXECUTOR_WALLET_BOUND",
          "Executor wallet binding is immutable",
          409,
        );
      const session = await tx.executorSession.update({
        where: { id },
        data: { state: input.state, heartbeatAt: new Date() },
      });
      // A heartbeat cannot clear a user pause. Pause/resume is a separate management action.
      if (input.paused !== undefined && input.paused !== old.paused)
        throw new AppError(
          "EXECUTOR_CONFIG_REQUIRED",
          "Use executor management to pause or resume",
          409,
        );
      if (input.state === "UNCONNECTED" && old.state !== "UNCONNECTED") {
        const run = await tx.agentRun.create({
          data: {
            kind: "EXECUTOR_STATUS",
            walletScope: session.walletScope,
            status: "ABORTED",
            summary: `${id} UNCONNECTED; execution paused; pair again in Grok Bot`,
            finishedAt: new Date(),
          },
        });
        await tx.agentNotification.create({
          data: { runId: run.id, message: run.summary },
        });
      }
      return session;
    });
  }
  async select(
    kind: string,
    executorId?: string,
    walletScope?: string,
  ): Promise<ExecutorSession> {
    if (executorId || walletScope) {
      const session = executorId
        ? await this.db.executorSession.findUnique({
            where: { id: executorId },
          })
        : await this.db.executorSession.findUnique({ where: { walletScope } });
      if (!session)
        throw new AppError("EXECUTOR_NOT_FOUND", "Executor not found", 404);
      assertRole(session, kind);
      if (walletScope && session.walletScope !== walletScope)
        throw new AppError(
          "WALLET_CHANGED",
          "Executor and confirmation wallet mismatch",
          409,
        );
      return session;
    }
    const role = kind === "FREE_MINT" ? "FREE_MINT" : "PAID";
    const sessions = await this.db.executorSession.findMany({
      where: { role },
      orderBy: { id: "asc" },
    });
    const selected =
      sessions.find((s) => s.isDefault) ||
      (sessions.length === 1 ? sessions[0] : null);
    if (!selected)
      throw new AppError(
        sessions.length ? "EXECUTOR_REQUIRED" : "EXECUTOR_NOT_CONFIGURED",
        "Select a target executor or configure a default for this role",
        409,
      );
    return selected;
  }
}
