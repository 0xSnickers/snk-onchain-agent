import { Injectable } from "@nestjs/common";
import { readFile, stat } from "node:fs/promises";
import { AppError } from "../../common/http";
import { KolRepository } from "./kol.repository";
import { parseSharedWatchlist, planSharedSync, sharedWatchlistPath } from "./shared-watchlist";

const MAX_BYTES = 1_000_000;

@Injectable()
export class KolSharedSyncService {
  constructor(private readonly repository: KolRepository) {}

  async sync() {
    const raw = await this.read(sharedWatchlistPath());
    let doc: unknown;
    try {
      doc = JSON.parse(raw.replace(/^\uFEFF/, ""));
    } catch {
      throw new AppError(
        "SHARED_WATCHLIST_INVALID",
        "Shared watchlist is not valid JSON",
        409,
      );
    }
    const parsed = parseSharedWatchlist(doc);
    const plan = planSharedSync(parsed, await this.repository.listSyncState());
    await this.repository.applyShared(plan.writes);
    return {
      created: plan.created,
      updated: plan.updated,
      skipped: plan.skipped,
      categories: plan.categories,
    };
  }

  private async read(path: string) {
    try {
      const info = await stat(path);
      if (!info.isFile() || info.size > MAX_BYTES) throw new Error("rejected");
      return await readFile(path, "utf8");
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "SHARED_WATCHLIST_UNAVAILABLE",
        "Shared watchlist file is missing or unreadable. Check KOL_SHARED_WATCHLIST_PATH.",
        409,
      );
    }
  }
}
