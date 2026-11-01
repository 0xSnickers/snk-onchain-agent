import { Module } from "@nestjs/common";
import { WalletModule } from "../wallet/wallet.module";
import { ResearchModule } from "../research/research.module";
import { RpcService } from "./rpc.service";
import { FreeService } from "./free.service";
import { PaidService } from "./paid.service";
import { ReconcileService } from "./reconcile.service";
@Module({
  imports: [WalletModule, ResearchModule],
  providers: [RpcService, FreeService, PaidService, ReconcileService],
  exports: [FreeService, PaidService, ReconcileService],
})
export class ExecutionModule {}
