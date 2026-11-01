import {
  paymentAssets,
  BuyInput,
  assertAudit,
  auditDigest,
  validQuote,
} from "./paid-policy";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AgentStore } from "../agent-runs/agent.store";
import { bscScope } from "../wallet/wallet-identity.service";
import { BawService } from "../wallet/baw.service";
import { ResearchProvider } from "../research/research.provider";
import { AppError } from "../../common/http";
import { object, safeError, safeJson } from "../../common/safe-data";
import { requireExecution } from "../../config/agent-env";
@Injectable()
export class PaidService {
  constructor(
    private readonly store: AgentStore,
    private readonly baw: BawService,
    private readonly research: ResearchProvider,
  ) {}
  private async wallet() {
    const s = await this.baw.run<{ status: string }>("status");
    if (s.status !== "CONNECTED")
      throw new AppError(
        "WALLET_NOT_CONNECTED",
        "Connect your wallet first",
        409,
      );
    const a = await this.baw.run<{
      addresses: { binanceChainId: string; address: string }[];
    }>("address");
    const from = a.addresses.find((a) => a.binanceChainId === "56")?.address;
    if (!from)
      throw new AppError(
        "WALLET_ADDRESS_MISSING",
        "No BSC wallet address",
        409,
      );
    return from;
  }
  async confirm(briefId: string, input: BuyInput, walletScope?: string) {
    if (input.confirmationText !== `确认买入 ${input.amount} ${input.asset}`)
      throw new AppError(
        "CONFIRM_REQUIRED",
        "Confirmation must match amount and payment asset exactly",
        409,
      );
    const brief = await this.store.brief(briefId);
    if (
      !brief.auditAvailable ||
      !brief.dynamicAvailable ||
      Date.now() - brief.createdAt.getTime() > 600000
    )
      throw new AppError(
        "RESEARCH_REQUIRED",
        "A fresh available audit and dynamic token brief is required",
        409,
      );
    if (brief.chainId !== "56")
      throw new AppError(
        "UNSUPPORTED_CHAIN",
        "Paid execution currently supports BSC only",
        409,
      );
    // Exclusive launches need their own on-chain stage / entitlement flow, never a silent route substitution.
    if (/(?:4444|ffff)$/i.test(brief.contractAddress))
      throw new AppError(
        "EXCLUSIVE_ROUTE_REQUIRES_REVIEW",
        "Launchpad suffix requires the separate on-chain stage and Agent ID route review",
        409,
      );
    await this.store.expire();
    const run = await this.store.beginCandidate(
      brief.candidateId,
      "PAID_BUY",
      ["BRIEF_READY"],
      walletScope,
    );
    try {
      const from = await this.wallet();
      await this.store.updateRun(run.id, { walletScope: bscScope(from) });
      const audit = await this.research.audit("56", brief.contractAddress);
      assertAudit(audit);
      await this.store.action(run.id, "audit.token", "ALLOW", audit);
      const fromToken = paymentAssets[input.asset];
      if (fromToken.toLowerCase() === brief.contractAddress.toLowerCase())
        throw new AppError(
          "INVALID_TRADE",
          "Payment and target tokens must differ",
          400,
        );
      const raw = await this.baw.run("quote", {
        chainId: "56",
        fromToken,
        toToken: brief.contractAddress,
        amount: input.amount,
        slippage: input.slippage,
      });
      const quote = Object.fromEntries(
        [
          "fromCoinSymbol",
          "fromCoinAmount",
          "toCoinSymbol",
          "toCoinAmount",
          "slippage",
        ].map((k) => [k, raw[k] ?? null]),
      );
      if (!validQuote(quote))
        throw new AppError(
          "QUOTE_UNAVAILABLE",
          "Provider did not return usable quote amounts",
          409,
        );
      const expiresAt = new Date(Date.now() + 120000);
      const confirm = await this.store.createConfirmation({
        runId: run.id,
        briefId,
        chainId: "56",
        contractAddress: brief.contractAddress,
        amount: input.amount,
        asset: input.asset,
        fromToken,
        walletAddress: from,
        slippage: input.slippage,
        confirmationText: input.confirmationText,
        quoteJson: safeJson(quote) as Prisma.InputJsonValue,
        expiresAt,
      });
      await this.store.action(run.id, "market.quote", "INFO", {
        ...quote,
        slippagePolicy: input.slippage,
      });
      await this.store.action(run.id, "user.confirm", "ALLOW", {
        confirmationId: confirm.id,
        amount: input.amount,
        asset: input.asset,
        contractAddress: brief.contractAddress,
      });
      await this.store.updateRun(run.id, {
        status: "AWAITING_CONFIRMATION",
        summary:
          "Quote ready; review full contract, risks, slippage and fees before final execution",
        expiresAt,
        contextJson: { auditDigest: auditDigest(audit) },
      });
      await this.store.updateCandidate(brief.candidateId, {
        status: "AWAITING_USER",
      });
    } catch (error) {
      await this.store.finish(
        run.id,
        "ABORTED",
        safeError(error).message,
        error,
      );
      await this.store.updateCandidate(brief.candidateId, {
        status: "BRIEF_READY",
      });
      throw error;
    }
    return this.store.run(run.id);
  }
  async execute(runId: string, confirmationId: string) {
    if (!confirmationId)
      throw new AppError(
        "CONFIRM_REQUIRED",
        "A stored spend confirmation is required",
        409,
      );
    requireExecution();
    return this.store.withLease("wallet-execution", async () => {
      const run = await this.store.run(runId);
      const confirm = run.confirmations.find((c) => c.id === confirmationId);
      if (
        run.kind !== "PAID_BUY" ||
        run.status !== "AWAITING_CONFIRMATION" ||
        !confirm
      )
        throw new AppError(
          "CONFIRM_REQUIRED",
          "A quote-bound confirmation is required",
          409,
        );
      if (confirm.consumedAt || confirm.expiresAt.getTime() <= Date.now())
        throw new AppError(
          "CONFIRM_CONSUMED",
          "Confirmation consumed or expired",
          409,
        );
      const wallet = await this.wallet();
      if (wallet.toLowerCase() !== confirm.walletAddress.toLowerCase())
        throw new AppError(
          "WALLET_CHANGED",
          "Wallet changed; create a new quote",
          409,
        );
      const audit = await this.research.audit("56", confirm.contractAddress);
      assertAudit(audit);
      if (object(run.contextJson).auditDigest !== auditDigest(audit))
        throw new AppError(
          "AUDIT_CHANGED",
          "Audit evidence changed; generate a new quote and review again",
          409,
        );
      await this.store.action(run.id, "audit.token", "ALLOW", audit);
      // Consume atomically BEFORE broadcast: a timeout must never make confirmation reusable.
      await this.store.claimExecution(run.id, confirm.id);
      await this.store.updateCandidate(run.candidateId!, {
        status: "EXECUTING",
      });
      await this.store.action(run.id, "market.swap", "INFO", {
        phase: "STARTED",
        amount: confirm.amount,
        asset: confirm.asset,
        slippage: confirm.slippage,
      });
      try {
        const result = await this.baw.run<{ orderId: string }>("swap", {
          chainId: "56",
          fromToken: confirm.fromToken,
          toToken: confirm.contractAddress,
          amount: confirm.amount,
          slippage: confirm.slippage,
        });
        if (!/^[a-zA-Z0-9_.-]{1,160}$/.test(result.orderId))
          throw new AppError("EXECUTION_UNKNOWN", "No usable order ID", 409);
        await this.store.action(run.id, "market.swap", "INFO", {
          orderId: result.orderId,
          status: "PENDING",
        });
        await this.store.updateRun(run.id, {
          status: "SUBMITTED",
          summary: "Swap submitted; awaiting terminal order status",
          contextJson: { orderId: result.orderId },
        });
        await this.store.updateCandidate(run.candidateId!, {
          status: "BUY_PENDING",
        });
        await this.store.notify(
          run.id,
          "Purchase submitted; execution is not yet confirmed",
        );
      } catch (error) {
        await this.store.finish(
          run.id,
          "UNKNOWN",
          "Swap outcome unknown; do not resubmit",
          error,
        );
        await this.store.updateCandidate(run.candidateId!, {
          status: "EXECUTION_UNKNOWN",
        });
      }
      return this.store.run(run.id);
    });
  }
}
