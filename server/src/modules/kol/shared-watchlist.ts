import { AppError } from "../../common/http";
import { KOL_CATEGORIES, type KolCategoryName } from "./kol-categories";

export const SHARED_WATCHLIST_SCHEMA =
  "agent-wallet-manager/x-mint-bloggers@1";
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
}

export interface ParsedSharedWatchlist {
  accounts: ParsedSharedAccount[];
  skipped: number;
}

export interface SharedKolState {
  handle: string;
  category: string;
  note: string;
  source: string | null;
}

export interface SharedKolWrite {
  handle: string;
  category: KolCategoryName;
  note: string;
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
  let skipped = 0;
  let seen = 0;
  for (const bucket of collectBuckets(doc, map)) {
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
    }
  }
  return { accounts: [...byHandle.values()], skipped };
}

export function planSharedSync(
  parsed: ParsedSharedWatchlist,
  existing: SharedKolState[],
) {
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
    const row = current.get(account.handle);
    if (!row) {
      created += 1;
      writes.push(account);
      continue;
    }
    if (
      row.category === account.category &&
      row.note === account.note &&
      row.source === "SHARED"
    ) {
      skipped += 1;
      continue;
    }
    updated += 1;
    writes.push(account);
  }
  return { writes, created, updated, skipped, categories };
}

function emptyCategories(): Record<KolCategoryName, number> {
  return { DAILY: 0, MEME: 0, AIRDROP: 0, AGENT_WALLET_MINT: 0 };
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

function collectBuckets(
  doc: Record<string, unknown>,
  map: Record<string, KolCategoryName>,
) {
  for (const key of NESTED_KEYS) {
    if (doc[key] != null && typeof doc[key] === "object")
      return bucketsFrom(doc[key]);
  }
  for (const key of FLAT_KEYS) {
    if (Array.isArray(doc[key])) return [{ key: "", entries: doc[key] }];
  }
  const buckets: { key: string; entries: unknown[] }[] = [];
  for (const [key, value] of Object.entries(doc)) {
    if (SKIP_TOP_LEVEL.has(key)) continue;
    const entries = entriesOf(value);
    if (!entries || !resolveCategory(key, map)) continue;
    buckets.push({ key, entries });
  }
  return buckets;
}

function bucketsFrom(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isGroup))
      return value.map((item) => {
        const group = item as Record<string, unknown>;
        return { key: groupKey(group), entries: entriesOf(group) ?? [] };
      });
    return [{ key: "", entries: value }];
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const entries = entriesOf(child);
    return entries ? [{ key, entries }] : [];
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
  return {
    handle,
    category,
    note: (typeof noteSource === "string" ? noteSource.trim() : "").slice(
      0,
      500,
    ),
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
    if (!["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(host))
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
