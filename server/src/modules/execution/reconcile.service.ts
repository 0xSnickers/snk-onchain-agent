import { Injectable } from "@nestjs/common";
import { AgentStore } from "../agent-runs/agent.store";
import { RpcService } from "./rpc.service";
import { safeError } from "../../common/safe-data";
@Injectable()
export class ReconcileService {
  constructor(
    private readonly store: AgentStore,
    private readonly rpc: RpcService,
  ) {}
  async run() {
    return this.store.withLease("reconcile", async () => {
      const pending = await this.store.pending();
      for (const run of pending) {
        try {
          if (run.kind === "PAID_BUY") continue;
          const hash = run.actions.find((a) => a.txHash)?.txHash;
          if (!hash) continue;
          const receipt = await this.rpc.receipt(hash);
          if (!receipt) continue;
          const success = receipt.status === "0x1";
          await this.store.action(
            run.id,
            "chain.receipt",
            "INFO",
            { status: receipt.status, blockNumber: receipt.blockNumber },
            { txHash: hash },
          );
          await this.store.finish(
            run.id,
            success ? "SUCCEEDED" : "FAILED",
            success
              ? "Free Mint confirmed on-chain. Gas paid. DYOR."
              : "Mint transaction reverted",
          );
          if (run.candidateId)
            await this.store.updateCandidate(run.candidateId, {
              status: success ? "MINTED" : "MINT_FAILED",
            });
        } catch (error) {
          await this.store.action(run.id, "reconcile", "DENY", safeError(error));
        }
      }
      return { checked: pending.length };
    });
  }
}
