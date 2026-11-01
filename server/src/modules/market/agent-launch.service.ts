import { Injectable } from "@nestjs/common";
import type {
  AgentLaunchMarket,
  AgentLaunchToken,
  LaunchSource,
} from "../../../../packages/contracts/src/launch";
import { AppError } from "../../common/http";
import { LaunchHttpProvider } from "./launch-http.provider";
import { FlapAgentProvider } from "./flap-agent.provider";
@Injectable()
export class AgentLaunchService {
  private cache?: { expires: number; data: AgentLaunchMarket };
  private pending?: Promise<AgentLaunchMarket>;
  constructor(
    private readonly http: LaunchHttpProvider,
    private readonly flap: FlapAgentProvider,
  ) {}
  async list(): Promise<AgentLaunchMarket> {
    if (this.cache && this.cache.expires > Date.now()) return this.cache.data;
    if (this.pending) return this.pending;
    this.pending = this.load()
      .then((data) => {
        this.cache = { expires: Date.now() + 30000, data };
        return data;
      })
      .finally(() => {
        this.pending = undefined;
      });
    return this.pending;
  }
  private async load(): Promise<AgentLaunchMarket> {
    const tasks: [LaunchSource, () => Promise<AgentLaunchToken[]>][] = [
      [
        "FOUR_AGENT",
        async () => {
          const lists = await Promise.all(
            ["MIGRATED", "FINALIZING", "NEW"].map((stage) =>
              this.http.four(stage as "NEW" | "FINALIZING" | "MIGRATED"),
            ),
          );
          // Later lifecycle wins if ranking windows overlap.
          return lists.flat();
        },
      ],
      ["FLAP_AGENT", () => this.flap.list()],
      ["GANG", () => this.http.gang(false)],
      ["GANG_V2", () => this.http.gang(true)],
    ];
    const results = await Promise.allSettled(tasks.map(([, run]) => run()));
    const tokens = new Map<string, AgentLaunchToken>();
    const sources: AgentLaunchMarket["sources"] = results.map((r, i) => {
      const source = tasks[i][0];
      if (r.status === "rejected")
        return {
          source,
          status: "ERROR",
          count: 0,
          error: {
            code:
              r.reason instanceof AppError
                ? r.reason.code
                : "LAUNCH_UNAVAILABLE",
            message: `${source} market source unavailable`,
          },
        };
      const unique = new Map<string, AgentLaunchToken>();
      for (const t of r.value)
        if (!unique.has(t.address)) unique.set(t.address, t);
      for (const t of unique.values())
        if (!tokens.has(t.address)) tokens.set(t.address, t);
      return { source, status: "OK", count: unique.size, error: null };
    });
    if (sources.every((s) => s.status === "ERROR"))
      throw new AppError(
        "LAUNCH_UNAVAILABLE",
        sources.map((s) => `${s.source}: ${s.error!.code}`).join("; "),
      );
    return {
      chain: "bsc",
      fetchedAt: new Date().toISOString(),
      scope: "AGENT_LAUNCHPADS",
      coverage: "BOUNDED_SAMPLE",
      tokens: [...tokens.values()],
      sources,
    };
  }
}
