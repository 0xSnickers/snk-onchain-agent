import { ActivityModule } from "./modules/wallet-activity/activity.module";
import { AgentModule } from "./modules/agent-runs/agent.module";
import { Controller, Get, Module } from "@nestjs/common";
import { WalletModule } from "./modules/wallet/wallet.module";
import { MarketModule } from "./modules/market/market.module";
import { KolModule } from "./modules/kol/kol.module";
import { SniperModule } from "./modules/sniper/sniper.module";
import { PrismaService } from "./prisma/prisma.service";
@Controller("health")
class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      database: "connected",
      mode: "local-wallet-companion",
    };
  }
}
@Module({
  imports: [WalletModule, MarketModule, KolModule, AgentModule, ActivityModule, SniperModule],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
