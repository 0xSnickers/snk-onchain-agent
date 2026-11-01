import { Injectable } from "@nestjs/common";
import { readFile, stat } from "node:fs/promises";
import { AppError } from "../../common/http";
import { KolRepository } from "./kol.repository";
import { KolReportRepository } from "./kol-report.repository";
import { groupReportDays } from "./kol-report-view";
import {
  parseSharedWatchlist,
  sharedWatchlistPath,
  SHARED_WATCHLIST_SCHEMA,
} from "./shared-watchlist";
import {
  planSharedSync,
  sharedContentHash,
  type SharedKolState,
} from "./shared-sync-plan";
import { reportDateFor } from "./shared-report-fields";

const MAX_BYTES = 1_000_000;

@Injectable()
export class KolSharedSyncService {
  constructor(
    private readonly repository: KolRepository,
    private readonly reportStore: KolReportRepository,
  ) {}

  async sync(now = new Date()) {
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
    const plan = planSharedSync(parsed, await this.state());
    const reportDate = reportDateFor(parsed.meta, now);
    const recorded = await this.reportStore.record({
      hash: sharedContentHash(parsed),
      schemaName: SHARED_WATCHLIST_SCHEMA,
      reportDate,
      generatedAt: parsed.meta.generatedAt,
      fileUpdatedAt: parsed.meta.fileUpdatedAt,
      summary: parsed.meta.summary,
      version: parsed.meta.version,
      owner: parsed.meta.owner,
      sections: parsed.sections,
      accounts: parsed.accounts,
      writes: plan.writes,
    });
    return {
      created: plan.created,
      updated: plan.updated,
      skipped: plan.skipped,
      categories: plan.categories,
      report: {
        id: recorded.reportId,
        ingested: recorded.ingested,
        reportDate: recorded.reportDate,
        entries: recorded.ingested ? parsed.accounts.length : 0,
      },
    };
  }

  async reports() {
    return { days: groupReportDays(await this.reportStore.listRecent()) };
  }

  private async state(): Promise<SharedKolState[]> {
    return (await this.repository.listSyncState()).map((row) => ({
      ...row,
      sharedAt: row.sharedAt ? row.sharedAt.toISOString() : null,
    }));
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
