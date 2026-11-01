import { Global, Module } from "@nestjs/common";
import { AgentLeaseRepository } from "./lease.repository";
import { AgentStore } from "./agent.store";
import { PrismaService } from "../../prisma/prisma.service";
import { NetworkService } from "../../common/network.service";
@Global()
@Module({
  providers: [PrismaService, AgentLeaseRepository, AgentStore, NetworkService],
  exports: [AgentStore, NetworkService],
})
export class AgentDataModule {}
