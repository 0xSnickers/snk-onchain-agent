import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AppError } from "../../common/http";
import { CreateKol, UpdateKol } from "./kol.dto";
const publicFields = {
  id: true,
  handle: true,
  displayName: true,
  avatarUrl: true,
  category: true,
  note: true,
  createdAt: true,
} as const;
type PostInput = {
  postId: string;
  text: string;
  authorId: string;
  authorHandle: string;
  postedAt: Date | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
};
@Injectable()
export class KolRepository {
  constructor(private readonly prisma: PrismaService) {}
  list() {
    return this.prisma.kol.findMany({
      orderBy: { createdAt: "desc" },
      select: publicFields,
    });
  }
  add(input: CreateKol) {
    return this.prisma.kol.upsert({
      where: { handle: input.handle.toLowerCase() },
      create: { ...input, handle: input.handle.toLowerCase() },
      update: { note: input.note, category: input.category },
      select: publicFields,
    });
  }
  find(id: string) {
    return this.prisma.kol.findUnique({ where: { id } });
  }
  posts(kolId: string) {
    return this.prisma.kolPost.findMany({
      where: { kolId },
      orderBy: [{ postedAt: "desc" }, { postId: "desc" }],
      take: 100,
    });
  }
  syncFailed(id: string, message: string, handle?: string) {
    return this.prisma.kol.updateMany({
      where: { id, ...(handle ? { handle } : {}) },
      data: { syncError: message.slice(0, 500) },
    });
  }
  private async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "Kol" WHERE "id" = ${id} FOR UPDATE`;
    const row = await tx.kol.findUnique({ where: { id } });
    if (!row) throw new AppError("KOL_NOT_FOUND", "KOL not found", 404);
    return row;
  }
  update(id: string, input: UpdateKol) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.lock(tx, id),
        handle = input.handle.toLowerCase();
      const changed = row.handle !== handle;
      if (changed) await tx.kolPost.deleteMany({ where: { kolId: id } });
      return tx.kol.update({
        where: { id },
        select: publicFields,
        data: {
          handle,
          category: input.category,
          ...(changed
            ? {
                xUserId: null,
                displayName: null,
                avatarUrl: null,
                lastSyncedAt: null,
                nextCursor: null,
                syncError: null,
              }
            : {}),
        },
      });
    });
  }
  async savePosts(
    kolId: string,
    userId: string,
    posts: PostInput[],
    nextCursor: string | null,
    displayName?: string | null,
    expectedHandle?: string,
    avatarUrl?: string | null,
  ) {
    const fetchedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lock(tx, kolId);
      if (expectedHandle && row.handle !== expectedHandle)
        throw new AppError(
          "KOL_CHANGED",
          "Account changed during sync; sync again",
          409,
        );
      for (const post of posts)
        await tx.kolPost.upsert({
          where: { kolId_postId: { kolId, postId: post.postId } },
          create: { ...post, kolId, fetchedAt },
          update: { ...post, fetchedAt },
        });
      await tx.kol.update({
        where: { id: kolId },
        data: {
          xUserId: userId,
          lastSyncedAt: fetchedAt,
          syncError: null,
          nextCursor,
          ...(displayName ? { displayName } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        },
      });
    });
  }
  remove(id: string) {
    return this.prisma.kol.deleteMany({ where: { id } });
  }
}
