import { DelegationRepository } from "../delegation/delegation.repository";
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { AgentStore } from "../agent-runs/agent.store";
import { MonitorService } from "./monitor.service";
import { ReconcileService } from "../execution/reconcile.service";
import { agentEnv } from "../../config/agent-env";
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private nextScan = Date.now() + agentEnv.intervalMs;
  constructor(
    private readonly store: AgentStore,
    private readonly delegation: DelegationRepository,
    private readonly monitor: MonitorService,
    private readonly reconcile: ReconcileService,
  ) {}
  async onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    await this.store.recover();
    this.timer = setInterval(() => {
      void this.tick();
    }, 30000);
    this.timer.unref();
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.delegation.expire();
      await this.store.expire();
      await this.reconcile.run();
      if (agentEnv.enabled && Date.now() >= this.nextScan) {
        this.nextScan = Date.now() + agentEnv.intervalMs;
        await this.monitor.start();
      }
    } catch {
      /* DB is SSOT. No raw provider data or secrets in process logs. */
    } finally {
      this.busy = false;
    }
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
