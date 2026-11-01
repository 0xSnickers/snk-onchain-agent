import { KOL_CATEGORIES } from "./kol-categories";

export interface StoredReport {
  id: string;
  reportDate: string;
  ingestedAt: string;
  generatedAt: string | null;
  summary: string;
  sections: StoredSection[];
  entries: StoredEntry[];
}

interface StoredSection {
  category: string;
  label: string;
  summary: string;
  highlights: string[];
  actions: string[];
}

interface StoredEntry {
  handle: string;
  category: string;
  note: string;
  summary: string;
  profileUrl: string | null;
  projects: string[];
  tweetUrls: string[];
}

export interface ReportSnapshot {
  id: string;
  ingestedAt: string;
  generatedAt: string | null;
  summary: string;
  sections: {
    category: string;
    label: string;
    summary: string;
    highlights: string[];
    actions: string[];
    accounts: StoredEntry[];
  }[];
}

export interface ReportDay {
  reportDate: string;
  earlierCount: number;
  latest: ReportSnapshot;
  earlier: ReportSnapshot[];
}

const EARLIER_LIMIT = 5;
const DAY_LIMIT = 30;

export function groupReportDays(rows: StoredReport[]): ReportDay[] {
  const byDate = new Map<string, StoredReport[]>();
  for (const row of rows) {
    const list = byDate.get(row.reportDate) ?? [];
    list.push(row);
    byDate.set(row.reportDate, list);
  }
  return [...byDate.keys()]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, DAY_LIMIT)
    .map((reportDate) => {
      const items = byDate
        .get(reportDate)!
        .sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt));
      const [latest, ...rest] = items;
      return {
        reportDate,
        earlierCount: rest.length,
        latest: toSnapshot(latest),
        earlier: rest.slice(0, EARLIER_LIMIT).map(toSnapshot),
      };
    });
}

function toSnapshot(row: StoredReport): ReportSnapshot {
  const byCategory = new Map<string, ReportSnapshot["sections"][number]>();
  for (const section of row.sections) {
    byCategory.set(section.category, { ...section, accounts: [] });
  }
  for (const entry of row.entries) {
    const section = byCategory.get(entry.category) ?? {
      category: entry.category,
      label: "",
      summary: "",
      highlights: [],
      actions: [],
      accounts: [],
    };
    section.accounts.push(entry);
    byCategory.set(entry.category, section);
  }
  const known = new Set<string>(KOL_CATEGORIES);
  const sections = [
    ...KOL_CATEGORIES.map((category) => byCategory.get(category)),
    ...[...byCategory.values()].filter(
      (section) => !known.has(section.category),
    ),
  ].filter((section): section is ReportSnapshot["sections"][number] =>
    Boolean(section && sectionHasContent(section)),
  );
  return {
    id: row.id,
    ingestedAt: row.ingestedAt,
    generatedAt: row.generatedAt,
    summary: row.summary,
    sections,
  };
}

function sectionHasContent(section: ReportSnapshot["sections"][number]) {
  return (
    section.accounts.length > 0 ||
    Boolean(section.summary || section.label) ||
    section.highlights.length > 0 ||
    section.actions.length > 0
  );
}
