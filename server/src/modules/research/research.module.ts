import { WalletModule } from "../wallet/wallet.module";
import { Module } from "@nestjs/common";
import { ResearchProvider } from "./research.provider";
import { ResearchService } from "./research.service";
@Module({
  imports: [WalletModule],
  providers: [ResearchProvider, ResearchService],
  exports: [ResearchService, ResearchProvider],
})
export class ResearchModule {}
