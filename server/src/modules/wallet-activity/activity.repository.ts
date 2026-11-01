import { Injectable } from "@nestjs/common";
import { Prisma, WalletActivity } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
@Injectable()
export class ActivityRepository {
  constructor(private readonly db: PrismaService) {}
  async save(rows: Omit<WalletActivity, "id" | "source" | "fetchedAt">[]) {
    for (const row of rows)
      await this.db.walletActivity.upsert({
        where: {
          walletScope_chainId_txHash: {
            walletScope: row.walletScope,
            chainId: row.chainId,
            txHash: row.txHash,
          },
        },
        create: {
          ...row,
          movements: row.movements as Prisma.InputJsonValue,
          networkFee: row.networkFee as Prisma.InputJsonValue,
        },
        update: {
          status: row.status,
          type: row.type,
          providerType: row.providerType,
          movements: row.movements as Prisma.InputJsonValue,
          networkFee: row.networkFee as Prisma.InputJsonValue,
          fetchedAt: new Date(),
        },
      });
  }
  async list(scope: string, cursor?: string, type?: string) {
    const rows = await this.db.walletActivity.findMany({
      where: {
        walletScope: scope,
        ...(type && type !== "ALL" ? { type } : {}),
      },
      orderBy: [{ txTime: "desc" }, { id: "desc" }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, 20);
    const actions = await this.db.agentAction.findMany({
      where: {
        txHash: { in: items.map((i) => i.txHash) },
        run: { walletScope: scope },
      },
      select: { runId: true, txHash: true },
    });
    return {
      items: items.map((i) => ({
        ...i,
        runIds: [
          ...new Set(
            actions.filter((a) => a.txHash === i.txHash).map((a) => a.runId),
          ),
        ],
      })),
      nextCursor: rows.length > 20 ? items.at(-1)!.id : null,
    };
  }
}
