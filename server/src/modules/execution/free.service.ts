import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { bscScope } from "../wallet/wallet-identity.service";
import { BawService } from "../wallet/baw.service";
import { AgentStore } from "../agent-runs/agent.store";
import { RpcService, FreeProof } from "./rpc.service";
import { evaluatePreview, projectPreview, Preview } from "./preview-gate";
import { AppError } from "../../common/http";
import { object, safeError } from "../../common/safe-data";
import { agentEnv, requireExecution } from "../../config/agent-env";
interface FreeContext {
  proof: FreeProof;
  preview: Preview;
}
@Injectable()
export class FreeService {
  constructor(
    private readonly baw: BawService,
    private readonly store: AgentStore,
    private readonly rpc: RpcService,
  ) {}
  async wallet() {
    const s = await this.baw.run<{ status: string }>("status");
    if (s.status !== "CONNECTED")
      throw new AppError(
        "WALLET_NOT_CONNECTED",
        "Connect your wallet first",
        409,
      );
    const settings = await this.baw.run("settings");
    const dev = object(settings.devMode);
    if (
      dev.enabled !== true ||
      Number(dev.expiresAt) * 1000 <= Date.now() ||
      !Number.isFinite(Number(dev.expiresAt))
    )
      throw new AppError(
        "DEV_MODE_OFF",
        "Enable Developer Mode in Binance App → Agentic Wallet → Settings",
        409,
      );
    const address = await this.baw.run<{
      addresses: { binanceChainId: string; address: string }[];
    }>("address");
    const from = address.addresses.find(
      (a) => a.binanceChainId === "56",
    )?.address;
    if (!from)
      throw new AppError(
        "WALLET_ADDRESS_MISSING",
        "No BSC address available",
        409,
      );
    return from;
  }
  async prepare(candidateId: string, walletScope?: string) {
    const candidate = await this.store.candidate(candidateId);
    if (candidate.class === "PAID_TOKEN")
      throw new AppError(
        "NOT_FREE",
        "Paid candidates cannot use the free mint path",
        409,
      );
    if (candidate.inputData === "0x")
      throw new AppError(
        "CALLDATA_REQUIRED",
        "Provide explicit mint calldata",
        400,
      );
    const run = await this.store.beginCandidate(
      candidateId,
      "FREE_MINT",
      undefined,
      walletScope,
    );
    try {
      const from = await this.wallet();
      await this.store.updateRun(run.id, { walletScope: bscScope(from) });
      await this.store.action(run.id, "wallet.settings", "ALLOW", {
        connected: true,
        developerMode: true,
        chainId: "56",
      });
      const proof = await this.rpc.proveFree(
        from,
        candidate.contractAddress,
        candidate.inputData,
      );
      await this.store.action(run.id, "onchain.price_check", "ALLOW", proof);
      const previewStarted = Date.now();
      const raw = await this.baw.run("contractPreview", {
        chainId: "56",
        from,
        to: candidate.contractAddress,
        inputData: candidate.inputData,
      });
      const preview = projectPreview(raw);
      await this.store.action(run.id, "contract.preview", "INFO", preview, {
        requestId: preview.requestId || undefined,
        durationMs: Date.now() - previewStarted,
      });
      evaluatePreview(preview, proof);
      await this.store.action(run.id, "gate.evaluate", "ALLOW", {
        value: "0",
        gasRequiredWei: proof.gasRequiredWei,
        expiresAt: preview.expiresAt,
      });
      await this.store.updateRun(run.id, {
        status: "AWAITING_CONFIRMATION",
        summary: "Clean zero-value preview; waiting for authorization",
        expiresAt: new Date(preview.expiresAt),
        contextJson: { proof, preview } as unknown as Prisma.InputJsonValue,
      });
      await this.store.updateCandidate(candidateId, {
        class: "FREE_MINT",
        status: "PREVIEW_OK",
      });
      await this.store.notify(
        run.id,
        "Zero-value Mint preview is ready; gas still applies. DYOR.",
      );
    } catch (error) {
      const e = safeError(error);
      await this.store.action(
        run.id,
        "gate.evaluate",
        "DENY",
        { code: e.code },
        { riskSummary: e.message },
      );
      await this.store.finish(run.id, "ABORTED", e.message, error);
      await this.store.updateCandidate(candidateId, {
        status:
          e.code === "NOT_FREE"
            ? "REJECTED_NOT_FREE"
            : e.code === "PREVIEW_RISKY"
              ? "PREVIEW_RISKY"
              : "ABORTED",
        ...(["NOT_FREE", "PRICE_UNVERIFIED", "PRICE_AMBIGUOUS"].includes(e.code)
          ? { class: "PAID_TOKEN" }
          : {}),
      });
    }
    const prepared = await this.store.run(run.id);
    if (
      prepared.status === "AWAITING_CONFIRMATION" &&
      agentEnv.autoFree &&
      agentEnv.executionEnabled &&
      candidate.autoExecute
    )
      return this.execute(run.id, true);
    return prepared;
  }
  async execute(runId: string, automatic = false) {
    requireExecution();
    return this.store.withLease("wallet-execution", async () => {
      const run = await this.store.run(runId);
      if (
        run.kind !== "FREE_MINT" ||
        run.status !== "AWAITING_CONFIRMATION" ||
        !run.candidate
      )
        throw new AppError(
          "CONFIRM_CONSUMED",
          "No executable free Mint preview",
          409,
        );
      if (automatic && !(agentEnv.autoFree && run.candidate.autoExecute))
        throw new AppError(
          "CONFIRM_REQUIRED",
          "Explicit authorization required",
          409,
        );
      const context = run.contextJson as unknown as FreeContext;
      const from = await this.wallet();
      if (from.toLowerCase() !== context.proof.from.toLowerCase())
        throw new AppError(
          "WALLET_CHANGED",
          "Wallet changed; create a new preview",
          409,
        );
      const proof = await this.rpc.proveFree(
        from,
        run.candidate.contractAddress,
        run.candidate.inputData,
      );
      if (proof.codeHash !== context.proof.codeHash)
        throw new AppError(
          "CONTRACT_CHANGED",
          "Contract bytecode changed; create a new preview",
          409,
        );
      evaluatePreview(context.preview, proof);
      await this.store.action(run.id, "user.confirm", "ALLOW", {
        automatic,
        gasBudgetWei: agentEnv.maxGasWei,
        value: "0",
      });
      await this.store.claimExecution(run.id);
      await this.store.updateCandidate(run.candidate.id, {
        status: "EXECUTING",
      });
      // Persist the intent BEFORE the irreversible call. Any ambiguity prevents replay.
      await this.store.action(
        run.id,
        "contract.execute",
        "INFO",
        { phase: "STARTED" },
        { requestId: context.preview.requestId },
      );
      try {
        const result = await this.baw.run<{
          status: string;
          orderId: string;
          txHash?: string;
        }>("contractExecute", { requestId: context.preview.requestId });
        const hash = /^0x[0-9a-f]{64}$/i.test(result.txHash || "")
          ? result.txHash
          : undefined;
        await this.store.action(
          run.id,
          "contract.execute",
          "INFO",
          { status: result.status, orderId: result.orderId },
          { txHash: hash, requestId: context.preview.requestId },
        );
        const waiting = result.status === "PENDING_CONFIRMATION";
        if (!waiting && !hash)
          throw new AppError(
            "EXECUTION_UNKNOWN",
            "No verifiable transaction hash; do not retry",
            409,
          );
        await this.store.updateRun(run.id, {
          status: "SUBMITTED",
          summary: waiting
            ? "Waiting for Binance App approval"
            : "Broadcasted; waiting for chain confirmation",
        });
        await this.store.updateCandidate(run.candidate.id, {
          status: waiting ? "AWAITING_APP" : "BROADCASTED",
        });
        await this.store.notify(
          run.id,
          waiting
            ? "Confirm the Mint in Binance App"
            : "Mint broadcasted; receipt not yet confirmed. DYOR.",
        );
      } catch (error) {
        await this.store.finish(
          run.id,
          "UNKNOWN",
          "Execution outcome unknown; never automatically retry",
          error,
        );
        await this.store.updateCandidate(run.candidate.id, {
          status: "EXECUTION_UNKNOWN",
        });
      }
      return this.store.run(run.id);
    });
  }
}
