import { AppError } from "../../common/http";
import { KOL_CATEGORIES, type KolCategoryName } from "./kol-categories";
import {
  readAccountExtras,
  readBucketMeta,
  readFileMeta,
  rememberSection,
  type SharedFileMeta,
} from "./shared-report-fields";

export const SHARED_WATCHLIST_SCHEMA = "agent-wallet-manager/x-mint-bloggers@1";
export const DEFAULT_SHARED_WATCHLIST_PATH =
  "/home/box/.config/shared/x-mint-bloggers.json";

const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const MAX_ACCOUNTS = 500;
const ACCOUNT_LIST_KEYS = ["accounts", "handles", "bloggers", "items"] as const;
const NESTED_KEYS = ["categories", "lists", "groups"] as const;
const FLAT_KEYS = ["accounts", "bloggers", "handles"] as const;
const SKIP_TOP_LEVEL = new Set([
  "schema",
  "snkKolHint",
  "updatedAt",
  "version",
  "owner",
  "generatedAt",
  "reportDate",
  "date",
  "summary",
  "digest",
  "dailySummary",
  "highlights",
  "actions",
  "actionableNotes",
]);

export const DEFAULT_CATEGORY_MAP: Record<string, KolCategoryName> = {
  daily: "DAILY",
  meme: "MEME",
  airdrop: "AIRDROP",
  agent_wallet_mint: "AGENT_WALLET_MINT",
};

export interface ParsedSharedAccount {
  handle: string;
  category: KolCategoryName;
  note: string;
  profileUrl: string | null;
  projects: string[];
  summary: string;
  tweetUrls: string[];
  reportedAt: string | null;
}

export interface ParsedSharedSection {
  category: KolCategoryName;
  label: string;
  summary: string;
  highlights: string[];
  actions: string[];
}

export interface ParsedSharedWatchlist {
  accounts: ParsedSharedAccount[];
  sections: ParsedSharedSection[];
  skipped: number;
  meta: SharedFileMeta;
}

export function sharedWatchlistPath() {
  const configured = process.env.KOL_SHARED_WATCHLIST_PATH?.trim();
  return configured || DEFAULT_SHARED_WATCHLIST_PATH;
}

export function parseSharedWatchlist(doc: unknown): ParsedSharedWatchlist {
  if (!isRecord(doc) || doc.schema !== SHARED_WATCHLIST_SCHEMA)
    throw new AppError(
      "SHARED_WATCHLIST_INVALID",
      "Shared watchlist schema must be agent-wallet-manager/x-mint-bloggers@1",
      409,
    );
  const map = categoryMap(doc);
  const byHandle = new Map<string, ParsedSharedAccount>();
  const sections = new Map<KolCategoryName, ParsedSharedSection>();
  let skipped = 0;
  let seen = 0;
  for (const bucket of collectBuckets(doc, map)) {
    const category = resolveCategory(bucket.key, map);
    if (category) rememberSection(sections, category, bucket);
    for (const raw of bucket.entries) {
      seen += 1;
      if (seen > MAX_ACCOUNTS)
        throw new AppError(
          "SHARED_WATCHLIST_INVALID",
          "Shared watchlist exceeds 500 accounts",
          409,
        );
      const account = parseAccount(raw, bucket.key, map);
      if (!account) {
        skipped += 1;
        continue;
      }
      const handle = account.handle.toLowerCase();
      if (byHandle.has(handle)) skipped += 1;
      byHandle.set(handle, { ...account, handle });
      rememberSection(sections, account.category, bucket);
    }
  }
  return {
    accounts: [...byHandle.values()],
    sections: [...sections.values()],
    skipped,
    meta: readFileMeta(doc),
  };
}

function categoryMap(doc: Record<string, unknown>) {
  const map: Record<string, KolCategoryName> = { ...DEFAULT_CATEGORY_MAP };
  const hint = doc.snkKolHint;
  if (!isRecord(hint) || !isRecord(hint.categoryMap)) return map;
  for (const [key, value] of Object.entries(hint.categoryMap)) {
    if (key.trim() && typeof value === "string" && isCategory(value))
      map[key] = value;
  }
  return map;
}

interface Bucket extends ReturnType<typeof readBucketMeta> {
  key: string;
  entries: unknown[];
}

function collectBuckets(
  doc: Record<string, unknown>,
  map: Record<string, KolCategoryName>,
) {
  for (const key of NESTED_KEYS) {
    if (doc[key] != null && typeof doc[key] === "object")
      return bucketsFrom(doc[key]);
  }
  for (const key of FLAT_KEYS) {
    if (Array.isArray(doc[key])) return [bucket("", doc[key], null)];
  }
  const buckets: Bucket[] = [];
  for (const [key, value] of Object.entries(doc)) {
    if (SKIP_TOP_LEVEL.has(key)) continue;
    const entries = entriesOf(value);
    if (!entries || !resolveCategory(key, map)) continue;
    buckets.push(bucket(key, entries, value));
  }
  return buckets;
}

function bucket(key: string, entries: unknown[], source: unknown): Bucket {
  return { key, entries, ...readBucketMeta(source) };
}

function bucketsFrom(value: unknown): Bucket[] {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isGroup))
      return value.map((item) => {
        const group = item as Record<string, unknown>;
        return bucket(groupKey(group), entriesOf(group) ?? [], group);
      });
    return [bucket("", value, null)];
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const entries = entriesOf(child);
    return entries ? [bucket(key, entries, child)] : [];
  });
}

function isGroup(value: unknown) {
  if (!isRecord(value) || !entriesOf(value)) return false;
  return ["id", "key", "category"].some(
    (field) => typeof value[field] === "string",
  );
}

function groupKey(item: Record<string, unknown>) {
  const key = item.id ?? item.key ?? item.category;
  return typeof key === "string" ? key : "";
}

function entriesOf(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  for (const key of ACCOUNT_LIST_KEYS)
    if (Array.isArray(value[key])) return value[key];
  return null;
}

function parseAccount(
  raw: unknown,
  bucketKey: string,
  map: Record<string, KolCategoryName>,
): ParsedSharedAccount | null {
  if (!isRecord(raw)) return null;
  const fromUrl = handleFromUrl(raw.xUrl ?? raw.url);
  const explicit = raw.handle;
  let handle: string | null;
  if (typeof explicit === "string" && explicit.trim()) {
    handle = normalizeHandle(explicit);
    if (!handle) return null;
    if (fromUrl && fromUrl.toLowerCase() !== handle.toLowerCase()) return null;
  } else {
    handle = fromUrl;
  }
  if (!handle) return null;
  const category =
    resolveCategory(bucketKey, map) ||
    resolveCategory(stringField(raw.category), map) ||
    resolveCategory(stringField(raw.group), map);
  if (!category) return null;
  const noteSource = raw.notes ?? raw.note;
  if (noteSource != null && typeof noteSource !== "string") return null;
  const profileUrl = fromUrl ? `https://x.com/${handle.toLowerCase()}` : null;
  return {
    handle,
    category,
    note: (typeof noteSource === "string" ? noteSource.trim() : "").slice(
      0,
      4000,
    ),
    ...readAccountExtras(raw, profileUrl),
  };
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeHandle(value: unknown) {
  if (typeof value !== "string") return null;
  const handle = value.trim().replace(/^@/, "");
  return HANDLE.test(handle) ? handle : null;
}

function handleFromUrl(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (
      !["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(host)
    )
      return null;
    const segment = url.pathname.split("/").filter(Boolean)[0] || "";
    let handle = segment;
    try {
      handle = decodeURIComponent(segment);
    } catch {
      return null;
    }
    return HANDLE.test(handle) ? handle : null;
  } catch {
    return null;
  }
}

function resolveCategory(key: string, map: Record<string, KolCategoryName>) {
  if (!key) return null;
  if (map[key]) return map[key];
  if (isCategory(key)) return key;
  const lower = key.toLowerCase();
  if (map[lower]) return map[lower];
  return null;
}

function isCategory(value: string): value is KolCategoryName {
  return (KOL_CATEGORIES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
