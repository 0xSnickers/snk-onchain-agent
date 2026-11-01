import { PrismaService } from "../../prisma/prisma.service";
import { RpcService } from "../execution/rpc.service";
import { MarketModule } from "../market/market.module";
import { DelegationController } from "../delegation/delegation.controller";
import { DelegationRepository } from "../delegation/delegation.repository";
import { DelegationService } from "../delegation/delegation.service";
import { DelegatedResultService } from "../delegation/result.service";
import { FairMintProvider } from "../delegation/detection.provider";
import { DetectionService } from "../delegation/detection.service";
import { Module } from "@nestjs/common";
import { AgentDataModule } from "./agent-data.module";
import { WalletModule } from "../wallet/wallet.module";
import { ExecutionModule } from "../execution/execution.module";
import { ResearchModule } from "../research/research.module";
import { MonitorService } from "../mint-monitor/monitor.service";
import { DiscoveryService } from "../mint-monitor/discovery.service";
import { SchedulerService } from "../mint-monitor/scheduler.service";
import { AgentController } from "./agent.controller";
@Module({
  imports: [
    AgentDataModule,
    WalletModule,
    ResearchModule,
    ExecutionModule,
    MarketModule,
  ],
  controllers: [AgentController, DelegationController],
  providers: [
    MonitorService,
    DiscoveryService,
    SchedulerService,
    PrismaService,
    RpcService,
    DelegationRepository,
    DelegationService,
    DelegatedResultService,
    FairMintProvider,
    DetectionService,
  ],
})
export class AgentModule {}
