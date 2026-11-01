import { NetworkService } from "../../common/network.service";
import { KolSyncService } from "./kol-sync.service";
import { XapiProvider } from "./xapi.provider";
import { Module } from "@nestjs/common";
import { KolController } from "./kol.controller";
import { KolService } from "./kol.service";
import { KolRepository } from "./kol.repository";
import { PrismaService } from "../../prisma/prisma.service";
@Module({
  controllers: [KolController],
  providers: [
    KolService,
    KolRepository,
    PrismaService,
    KolSyncService,
    XapiProvider,
    NetworkService,
  ],
})
export class KolModule {}
