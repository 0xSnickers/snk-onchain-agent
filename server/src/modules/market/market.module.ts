import { Module } from "@nestjs/common";
import { NetworkService } from "../../common/network.service";
import { MarketController } from "./market.controller";
import { MarketService } from "./market.service";
import { DexscreenerProvider } from "./dexscreener.provider";
import { GmgnProvider } from "./gmgn.provider";
import { AgentLaunchService } from "./agent-launch.service";
import { LaunchHttpProvider } from "./launch-http.provider";
import { FlapAgentProvider } from "./flap-agent.provider";
@Module({
  exports: [AgentLaunchService],
  controllers: [MarketController],
  providers: [
    AgentLaunchService,
    LaunchHttpProvider,
    FlapAgentProvider,
    MarketService,
    DexscreenerProvider,
    GmgnProvider,
    NetworkService,
  ],
})
export class MarketModule {}
