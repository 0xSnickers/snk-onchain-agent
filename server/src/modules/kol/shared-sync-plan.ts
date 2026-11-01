import { createHash } from "node:crypto";
import type { KolCategoryName } from "./kol-categories";
import type {
  ParsedSharedAccount,
  ParsedSharedSection,
  ParsedSharedWatchlist,
} from "./shared-watchlist";

export interface SharedKolState {
  handle: string;
  category: string;
  note: string;
  source: string | null;
  profileUrl?: string | null;
  projects?: string[];
  summary?: string;
  sharedAt?: string | null;
}

export interface SharedKolWrite {
  handle: string;
  category: KolCategoryName;
  note: string;
  profileUrl: string | null;
  projects: string[];
  summary: string;
  sharedAt: string | null;
}

export function sharedContentHash(parsed: ParsedSharedWatchlist) {
  const body = {
    accounts: [...parsed.accounts]
      .sort((a, b) => a.handle.localeCompare(b.handle))
      .map(stableAccount),
    meta: parsed.meta,
    sections: [...parsed.sections]
      .sort((a, b) => a.category.localeCompare(b.category))
      .map(stableSection),
  };
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

export function planSharedSync(
  parsed: ParsedSharedWatchlist,
  existing: SharedKolState[],
) {
  const observedAt =
    parsed.meta.generatedAt || parsed.meta.fileUpdatedAt || null;
  const current = new Map(
    existing.map((row) => [row.handle.toLowerCase(), row]),
  );
  const categories = emptyCategories();
  const writes: SharedKolWrite[] = [];
  let created = 0;
  let updated = 0;
  let skipped = parsed.skipped;
  for (const account of parsed.accounts) {
    categories[account.category] += 1;
    const write = toWrite(account, account.reportedAt || observedAt);
    const row = current.get(account.handle);
    if (!row) {
      created += 1;
      writes.push(write);
      continue;
    }
    if (sameRow(row, write)) {
      skipped += 1;
      continue;
    }
    updated += 1;
    writes.push(write);
  }
  return { writes, created, updated, skipped, categories };
}

function toWrite(
  account: ParsedSharedAccount,
  sharedAt: string | null,
): SharedKolWrite {
  return {
    handle: account.handle,
    category: account.category,
    note: account.note,
    profileUrl: account.profileUrl,
    projects: account.projects,
    summary: account.summary,
    sharedAt,
  };
}

function sameRow(row: SharedKolState, write: SharedKolWrite) {
  return (
    row.category === write.category &&
    row.note === write.note &&
    row.source === "SHARED" &&
    (row.profileUrl ?? null) === write.profileUrl &&
    (row.summary ?? "") === write.summary &&
    sameList(row.projects ?? [], write.projects) &&
    (row.sharedAt ?? null) === write.sharedAt
  );
}

function sameList(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function stableAccount(account: ParsedSharedAccount) {
  return {
    category: account.category,
    handle: account.handle,
    note: account.note,
    profileUrl: account.profileUrl,
    projects: account.projects,
    reportedAt: account.reportedAt,
    summary: account.summary,
    tweetUrls: account.tweetUrls,
  };
}

function stableSection(section: ParsedSharedSection) {
  return {
    actions: section.actions,
    category: section.category,
    highlights: section.highlights,
    label: section.label,
    summary: section.summary,
  };
}

function emptyCategories(): Record<KolCategoryName, number> {
  return { DAILY: 0, MEME: 0, AIRDROP: 0, AGENT_WALLET_MINT: 0 };
}
