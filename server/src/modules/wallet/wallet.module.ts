import { PrismaService } from "../../prisma/prisma.service";
import { WalletIdentityService } from "./wallet-identity.service";
import { Module } from "@nestjs/common";
import { NetworkService } from "../../common/network.service";
import { BawService } from "./baw.service";
import { HoldingsService } from "./holdings.service";
import { WalletService } from "./wallet.service";
import { WalletController } from "./wallet.controller";
@Module({
  controllers: [WalletController],
  providers: [
    PrismaService,
    BawService,
    WalletService,
    WalletIdentityService,
    HoldingsService,
    NetworkService,
  ],
  exports: [BawService, WalletIdentityService],
})
export class WalletModule {}
