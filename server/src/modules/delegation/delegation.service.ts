import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppError } from "../../common/http";
import { DelegationRepository } from "./delegation.repository";
import { DelegatedBuyInput } from "./delegation.dto";
import { FairMintProvider } from "./detection.provider";
import { AgentStore } from "../agent-runs/agent.store";
export const json = (value: unknown) => value as Prisma.InputJsonValue;
@Injectable()
export class DelegationService {
  constructor(
    private readonly repo: DelegationRepository,
    private readonly fair: FairMintProvider,
    private readonly store: AgentStore,
  ) {}
  async queue(candidateId: string, targetId?: string) {
    const c = await this.store.candidate(candidateId);
    if (
      ["MINTED", "BOUGHT", "EXECUTION_UNKNOWN", "EXECUTING"].includes(c.status)
    )
      throw new AppError(
        "CANDIDATE_PROCESSED",
        "Candidate already processed or execution unknown",
        409,
      );
    const gates = await this.fair.gates(c.contractAddress);
    const free =
      c.class === "FREE_MINT" &&
      c.inputData !== "0x" &&
      gates.priceWei === "0" &&
      gates.holdersVerified &&
      (gates.holders || 0) > 100;
    const kind = free ? "FREE_MINT" : "PAID_RESEARCH";
    const existing = await this.repo.queued(candidateId, kind);
    if (existing) {
      if (targetId && targetId !== existing.executorId)
        throw new AppError(
          "OUTBOX_BOUND",
          "Existing task remains bound to its original executor",
          409,
        );
      return existing;
    }
    const session = await this.repo.selectExecutor(kind, targetId);
    const executorId = session.id;
    const row = await this.repo.enqueue({
      candidateId,
      executorId,
      walletScope: session.walletScope,
      kind,
      provider: c.source,
      expiresAt: new Date(Date.now() + 900000),
      payload: json({
        candidateId,
        kind,
        chainId: "56",
        contract: c.contractAddress,
        symbol: c.symbol,
        name: c.name,
        provider: c.source,
        walletScopeHint: session.walletScope,
        inputData: c.inputData,
        gates,
        createdAt: new Date().toISOString(),
      }),
    });
    if (row.status === "PENDING") await this.repo.markQueued(c.id, free);
    return row;
  }
  async confirm(briefId: string, input: DelegatedBuyInput) {
    if (
      input.confirmationText !== `确认买入 ${input.amount} ${input.asset}` ||
      !/[1-9]/.test(input.amount)
    )
      throw new AppError(
        "CONFIRM_REQUIRED",
        "Enter the exact buy confirmation with a positive amount",
        409,
      );
    const brief = await this.store.brief(briefId);
    if (
      !brief.auditAvailable ||
      !brief.dynamicAvailable ||
      Date.now() - brief.createdAt.getTime() > 900000 ||
      ["HIGH", "CRITICAL"].includes(brief.riskLevel || "")
    )
      throw new AppError(
        "RESEARCH_REQUIRED",
        "Fresh research and supported audit are required",
        409,
      );
    if (
      ["MINTED", "BOUGHT", "EXECUTION_UNKNOWN", "EXECUTING"].includes(
        brief.candidate.status,
      )
    )
      throw new AppError(
        "CANDIDATE_PROCESSED",
        "Candidate already processed or unknown",
        409,
      );
    const evidence = brief.evidenceJson as {
      audit?: { available?: boolean; severity?: number | null };
    };
    if (
      !evidence.audit?.available ||
      evidence.audit.severity == null ||
      evidence.audit.severity >= 4
    )
      throw new AppError(
        "AUDIT_UNAVAILABLE",
        "Supported low-risk audit required",
        409,
      );
    const session = await this.repo.selectExecutor(
      "PAID_BUY",
      undefined,
      input.walletScope,
    );
    const row = await this.repo.enqueue({
      candidateId: brief.candidateId,
      executorId: session.id,
      walletScope: input.walletScope,
      kind: "PAID_BUY",
      provider: brief.candidate.source,
      expiresAt: new Date(Date.now() + 300000),
      confirmation: json({
        ...input,
        briefId,
        confirmedAt: new Date().toISOString(),
      }),
      payload: json({
        candidateId: brief.candidateId,
        kind: "PAID_BUY",
        chainId: "56",
        contract: brief.contractAddress,
        provider: brief.candidate.source,
        walletScopeHint: input.walletScope,
        amount: input.amount,
        asset: input.asset,
        slippage: input.slippage,
        briefId,
        gates: {
          agentMustRevalidate: true,
          quoteRequired: true,
          auditRequired: true,
        },
        createdAt: new Date().toISOString(),
      }),
    });
    const confirmation = row.confirmation as {
      confirmationText?: string;
      briefId?: string;
    } | null;
    if (
      row.status !== "PENDING" ||
      confirmation?.confirmationText !== input.confirmationText ||
      confirmation?.briefId !== briefId
    )
      throw new AppError(
        "OUTBOX_CONSUMED",
        "An existing intent is already bound to this candidate/wallet; do not replay",
        409,
      );
    return row;
  }
}
