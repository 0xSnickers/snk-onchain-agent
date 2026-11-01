import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  HttpCode,
} from "@nestjs/common";
import { WalletScopeQuery } from "../wallet/wallet-scope.dto";
import { DetectionService } from "../delegation/detection.service";
import { WalletIdentityService } from "../wallet/wallet-identity.service";
import { AgentStore } from "./agent.store";
import { RunQuery, ExecuteInput } from "./agent.dto";
import { CandidateInput } from "../mint-monitor/candidate.dto";
import { ResearchService } from "../research/research.service";
import { agentEnv } from "../../config/agent-env";
import { AppError } from "../../common/http";
import { refuseLiveWallet } from "../wallet/wallet-delegation";
@Controller()
export class AgentController {
  constructor(
    private readonly identity: WalletIdentityService,
    private readonly detection: DetectionService,
    private readonly store: AgentStore,
    private readonly research: ResearchService,
  ) {}
  @Get("agent/config") config() {
    return {
      enabled: agentEnv.enabled,
      executionEnabled: agentEnv.executionEnabled,
      autoFree: agentEnv.autoFree,
      discoveryEnabled: agentEnv.discoveryEnabled,
      socialEnabled: agentEnv.socialEnabled,
      intervalMs: agentEnv.intervalMs,
      chainIds: ["56"],
      rpcConfigured: Boolean(agentEnv.rpc),
      maxGasWei: agentEnv.maxGasWei,
    };
  }
  @Get("agent/runs") async runs(@Query() q: RunQuery) {
    const walletScope = (await this.identity.current(q.walletScope)).scope;
    const list = await this.store.runs(q.cursor, q.limit, walletScope);
    const items = list.slice(0, q.limit);
    return {
      walletScope,
      items,
      nextCursor: list.length > q.limit ? items.at(-1)?.id : null,
    };
  }
  @Get("agent/runs/:id") async run(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: WalletScopeQuery,
  ) {
    const run = await this.store.run(id);
    if (
      run.walletScope &&
      run.walletScope !== (await this.identity.current(q.walletScope)).scope
    )
      throw new AppError(
        "RUN_NOT_FOUND",
        "Run not found for current wallet",
        404,
      );
    const { contextJson: _context, confirmations, ...view } = run;
    void _context;
    return {
      ...view,
      confirmations: confirmations.map((c) => ({
        id: c.id,
        amount: c.amount,
        asset: c.asset,
        slippage: c.slippage,
        contractAddress: c.contractAddress,
        quote: c.quoteJson,
        expiresAt: c.expiresAt,
        consumedAt: c.consumedAt,
      })),
    };
  }
  @Post("agent/scan") @HttpCode(202) scan() {
    return this.detection.scan();
  }
  @Post("agent/reconcile") reconcileAll() {
    refuseLiveWallet();
  }
  @Get("mint/candidates") candidates() {
    return this.store.candidates();
  }
  @Post("mint/candidates") async candidate(@Body() input: CandidateInput) {
    if (
      input.autoExecute &&
      (input.class !== "FREE_MINT" || input.inputData === "0x")
    )
      throw new AppError(
        "INVALID_AUTO_POLICY",
        "Automatic permission requires an explicit free Mint candidate and calldata",
        400,
      );
    return this.store.addCandidate({ ...input, source: "MANUAL" });
  }
  @Post("mint/free/:id/retry") retry() {
    refuseLiveWallet();
  }
  @Post("mint/:id/research") researchCandidate(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.research.create(id);
  }
  @Get("research/briefs") briefs() {
    return this.store.briefs();
  }
  @Post("research/briefs/:id/confirm-buy") buy() {
    refuseLiveWallet();
  }
  @Post("agent/runs/:id/execute") execute(@Body() input: ExecuteInput) {
    void input;
    refuseLiveWallet();
  }
  @Get("agent/notifications") async notifications(
    @Query() q: WalletScopeQuery,
  ) {
    return this.store.notifications(
      (await this.identity.current(q.walletScope)).scope,
    );
  }
  @Post("agent/notifications/:id/read") async read(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: WalletScopeQuery,
  ) {
    return this.store.readNotification(
      id,
      (await this.identity.current(q.walletScope)).scope,
    );
  }
}
