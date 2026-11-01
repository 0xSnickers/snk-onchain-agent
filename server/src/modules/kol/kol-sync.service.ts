import { Injectable } from "@nestjs/common";
import { AppError } from "../../common/http";
import { KolRepository } from "./kol.repository";
import { XapiProvider, xapiConfigured } from "./xapi.provider";
@Injectable()
export class KolSyncService {
  private pending = new Set<string>();
  private cooldown = new Map<string, number>();
  constructor(
    private readonly repository: KolRepository,
    private readonly xapi: XapiProvider,
  ) {}
  async posts(id: string) {
    const kol = await this.repository.find(id);
    if (!kol) throw new AppError("KOL_NOT_FOUND", "KOL not found", 404);
    return {
      source: "xapi.to",
      kolId: id,
      posts: await this.repository.posts(id),
      nextCursor: kol.nextCursor,
      lastSyncedAt: kol.lastSyncedAt,
      error: kol.syncError,
    };
  }
  async sync(id: string, more = false) {
    if (!xapiConfigured()) {
      const kol = await this.repository.find(id);
      if (!kol) throw new AppError("KOL_NOT_FOUND", "KOL not found", 404);
      return {
        source: "xapi.to" as const,
        imported: 0,
        fetchedAt: new Date().toISOString(),
        skipped: true,
        reason: "XAPI_OPTIONAL",
      };
    }
    if (this.pending.has(id))
      throw new AppError("KOL_SYNC_BUSY", "KOL sync is already running", 409);
    if ((this.cooldown.get(id) || 0) > Date.now())
      throw new AppError(
        "KOL_SYNC_COOLDOWN",
        "Wait 60 seconds before syncing this KOL again",
        429,
      );
    this.pending.add(id);
    let currentHandle: string | undefined;
    try {
      const kol = await this.repository.find(id);
      if (!kol) throw new AppError("KOL_NOT_FOUND", "KOL not found", 404);
      currentHandle = kol.handle;
      if (more && !kol.nextCursor)
        throw new AppError(
          "KOL_NO_MORE",
          "No saved cursor for more posts",
          409,
        );
      this.cooldown.set(id, Date.now() + 60000);
      if (this.cooldown.size > 1000)
        for (const [key, until] of this.cooldown)
          if (until < Date.now()) this.cooldown.delete(key);
      const profile =
        !kol.xUserId || !kol.displayName || !kol.avatarUrl
          ? await this.xapi.profile(kol.handle)
          : null;
      if (kol.xUserId && profile && kol.xUserId !== profile.id)
        throw new AppError(
          "KOL_IDENTITY_CHANGED",
          "This handle now belongs to another account; review the watchlist entry",
          409,
        );
      const userId = kol.xUserId || profile!.id;
      const page = await this.xapi.tweets(
        userId,
        more ? kol.nextCursor! : undefined,
      );
      await this.repository.savePosts(
        id,
        userId,
        page.posts,
        page.nextCursor,
        profile?.displayName,
        kol.handle,
        profile?.avatarUrl,
      );
      return {
        source: "xapi.to",
        imported: page.posts.length,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError && error.code !== "KOL_NOT_FOUND")
        await this.repository.syncFailed(id, error.message, currentHandle);
      throw error;
    } finally {
      this.pending.delete(id);
    }
  }
}
