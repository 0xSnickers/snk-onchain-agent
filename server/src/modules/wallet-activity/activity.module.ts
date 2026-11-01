import { Module } from "@nestjs/common";
import { WalletModule } from "../wallet/wallet.module";
import { PrismaService } from "../../prisma/prisma.service";
import { ActivityController } from "./activity.controller";
import { ActivityRepository } from "./activity.repository";
import { ActivityService } from "./activity.service";
@Module({
  imports: [WalletModule],
  controllers: [ActivityController],
  providers: [PrismaService, ActivityRepository, ActivityService],
})
export class ActivityModule {}
