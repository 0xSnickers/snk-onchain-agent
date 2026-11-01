import { Module } from "@nestjs/common";
import { NetworkService } from "../../common/network.service";
import { PrismaService } from "../../prisma/prisma.service";
import { MarketModule } from "../market/market.module";
import { SniperController } from "./sniper.controller";
import { SniperRepository } from "./sniper.repository";
import { SniperRpc } from "./sniper-rpc";
import { SniperService } from "./sniper.service";

@Module({
  imports: [MarketModule],
  controllers: [SniperController],
  providers: [SniperService, SniperRepository, SniperRpc, PrismaService, NetworkService],
})
export class SniperModule {}
