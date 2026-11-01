import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AppError } from "../../common/http";
@Injectable()
export class AgentLeaseRepository {
  constructor(private readonly db: PrismaService) {}
  async withLease<T>(key: string, fn: () => Promise<T>) {
    const owner = randomUUID();
    await this.db.agentLease.upsert({
      where: { key },
      create: { key, owner: "", expiresAt: new Date(0) },
      update: {},
    });
    const lock = await this.db.agentLease.updateMany({
      where: { key, expiresAt: { lt: new Date() } },
      data: { owner, expiresAt: new Date(Date.now() + 600000) },
    });
    if (!lock.count)
      throw new AppError(
        "AGENT_BUSY",
        "Another operation holds the execution lease",
        409,
      );
    try {
      return await fn();
    } finally {
      await this.db.agentLease.updateMany({
        where: { key, owner },
        data: { expiresAt: new Date(0) },
      });
    }
  }
}
