import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  ParsedSharedAccount,
  ParsedSharedSection,
} from "./shared-watchlist";
import type { SharedKolWrite } from "./shared-sync-plan";
import type { StoredReport } from "./kol-report-view";

export interface SharedSnapshot {
  hash: string;
  schemaName: string;
  reportDate: string;
  generatedAt: string | null;
  fileUpdatedAt: string | null;
  summary: string;
  version: string | null;
  owner: string | null;
  sections: ParsedSharedSection[];
  accounts: ParsedSharedAccount[];
  writes: SharedKolWrite[];
}

@Injectable()
export class KolReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(snapshot: SharedSnapshot) {
    const existing = await this.prisma.kolSharedReport.findUnique({
      where: { contentHash: snapshot.hash },
    });
    if (existing) {
      await this.writeAccounts(this.prisma, snapshot.writes);
      return {
        reportId: existing.id,
        ingested: false,
        reportDate: existing.reportDate,
      };
    }
    try {
      return await this.prisma.$transaction((tx) => this.insert(tx, snapshot));
    } catch (error) {
      if (!uniqueConflict(error)) throw error;
      const row = await this.prisma.kolSharedReport.findUnique({
        where: { contentHash: snapshot.hash },
      });
      if (!row) throw error;
      await this.writeAccounts(this.prisma, snapshot.writes);
      return { reportId: row.id, ingested: false, reportDate: row.reportDate };
    }
  }

  async listRecent(): Promise<StoredReport[]> {
    const rows = await this.prisma.kolSharedReport.findMany({
      orderBy: [{ reportDate: "desc" }, { ingestedAt: "desc" }],
      take: 100,
      include: {
        sections: { orderBy: { category: "asc" } },
        entries: { orderBy: { handle: "asc" } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      reportDate: row.reportDate,
      ingestedAt: row.ingestedAt.toISOString(),
      generatedAt: row.generatedAt?.toISOString() ?? null,
      summary: row.summary,
      sections: row.sections.map((section) => ({
        category: section.category,
        label: section.label,
        summary: section.summary,
        highlights: section.highlights,
        actions: section.actions,
      })),
      entries: row.entries.map((entry) => ({
        handle: entry.handle,
        category: entry.category,
        note: entry.note,
        summary: entry.summary,
        profileUrl: entry.profileUrl,
        projects: entry.projects,
        tweetUrls: entry.tweetUrls,
      })),
    }));
  }

  private async insert(tx: Prisma.TransactionClient, snapshot: SharedSnapshot) {
    const ids = await this.writeAccounts(tx, snapshot.writes);
    const missing = snapshot.accounts.filter(
      (account) => !ids.has(account.handle),
    );
    if (missing.length) {
      const rows = await tx.kol.findMany({
        where: { handle: { in: missing.map((account) => account.handle) } },
        select: { id: true, handle: true },
      });
      for (const row of rows) ids.set(row.handle, row.id);
    }
    const report = await tx.kolSharedReport.create({
      data: {
        contentHash: snapshot.hash,
        schemaName: snapshot.schemaName,
        reportDate: snapshot.reportDate,
        generatedAt: asDate(snapshot.generatedAt),
        fileUpdatedAt: asDate(snapshot.fileUpdatedAt),
        summary: snapshot.summary,
        version: snapshot.version,
        owner: snapshot.owner,
      },
    });
    const sections = snapshot.sections.filter(sectionHasBody);
    if (sections.length)
      await tx.kolSharedSection.createMany({
        data: sections.map((section) => ({
          reportId: report.id,
          category: section.category,
          label: section.label,
          summary: section.summary,
          highlights: section.highlights,
          actions: section.actions,
        })),
      });
    if (snapshot.accounts.length)
      await tx.kolSharedEntry.createMany({
        data: snapshot.accounts.map((account) => ({
          reportId: report.id,
          kolId: ids.get(account.handle) ?? null,
          handle: account.handle,
          category: account.category,
          note: account.note,
          summary: account.summary,
          profileUrl: account.profileUrl,
          projects: account.projects,
          tweetUrls: account.tweetUrls,
          reportedAt: asDate(account.reportedAt),
        })),
      });
    return {
      reportId: report.id,
      ingested: true,
      reportDate: snapshot.reportDate,
    };
  }

  private async writeAccounts(
    tx: Prisma.TransactionClient | PrismaService,
    writes: SharedKolWrite[],
  ) {
    const ids = new Map<string, string>();
    for (const row of writes) {
      const saved = await tx.kol.upsert({
        where: { handle: row.handle },
        create: {
          handle: row.handle,
          category: row.category,
          note: row.note,
          source: "SHARED",
          profileUrl: row.profileUrl,
          projects: row.projects,
          summary: row.summary,
          sharedAt: asDate(row.sharedAt),
        },
        update: {
          category: row.category,
          note: row.note,
          source: "SHARED",
          profileUrl: row.profileUrl,
          projects: row.projects,
          summary: row.summary,
          sharedAt: asDate(row.sharedAt),
        },
        select: { id: true, handle: true },
      });
      ids.set(saved.handle, saved.id);
    }
    return ids;
  }
}

function sectionHasBody(section: ParsedSharedSection) {
  return Boolean(
    section.label ||
    section.summary ||
    section.highlights.length ||
    section.actions.length,
  );
}

function asDate(value: string | null) {
  return value ? new Date(value) : null;
}

function uniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
