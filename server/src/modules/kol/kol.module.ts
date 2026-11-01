import { NetworkService } from "../../common/network.service";
import { KolSyncService } from "./kol-sync.service";
import { KolSharedSyncService } from "./kol-shared-sync.service";
import { XapiProvider } from "./xapi.provider";
import { Module } from "@nestjs/common";
import { KolController } from "./kol.controller";
import { KolService } from "./kol.service";
import { KolRepository } from "./kol.repository";
import { KolReportRepository } from "./kol-report.repository";
import { PrismaService } from "../../prisma/prisma.service";
@Module({
  controllers: [KolController],
  providers: [
    KolService,
    KolRepository,
    KolReportRepository,
    PrismaService,
    KolSyncService,
    KolSharedSyncService,
    XapiProvider,
    NetworkService,
  ],
})
export class KolModule {}
