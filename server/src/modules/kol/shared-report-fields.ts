const STATUS =
  /^https:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{1,30}\/?$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface SharedFileMeta {
  explicitDate: string | null;
  generatedAt: string | null;
  fileUpdatedAt: string | null;
  summary: string;
  version: string | null;
  owner: string | null;
}

export interface BucketMeta {
  label: string;
  summary: string;
  highlights: string[];
  actions: string[];
}

export interface AccountExtras {
  profileUrl: string | null;
  projects: string[];
  summary: string;
  tweetUrls: string[];
  reportedAt: string | null;
}

export function rememberSection<C extends string>(
  sections: Map<C, BucketMeta & { category: C }>,
  category: C,
  bucket: BucketMeta,
) {
  const current = sections.get(category) ?? {
    category,
    label: "",
    summary: "",
    highlights: [],
    actions: [],
  };
  sections.set(category, {
    category,
    label: current.label || bucket.label,
    summary: current.summary || bucket.summary,
    highlights: joinUnique(current.highlights, bucket.highlights),
    actions: joinUnique(current.actions, bucket.actions),
  });
}

function joinUnique(left: string[], right: string[]) {
  const items = [...left];
  for (const item of right)
    if (!items.includes(item) && items.length < 20) items.push(item);
  return items;
}

export function readFileMeta(doc: Record<string, unknown>): SharedFileMeta {
  return {
    explicitDate: day(doc.reportDate) || day(doc.date),
    generatedAt: isoTimestamp(doc.generatedAt),
    fileUpdatedAt: isoTimestamp(doc.updatedAt),
    summary:
      text(doc.summary, 4000) ||
      text(doc.digest, 4000) ||
      text(doc.dailySummary, 4000),
    version: short(doc.version, 40),
    owner: short(doc.owner, 80),
  };
}

export function readBucketMeta(value: unknown): BucketMeta {
  if (!isRecord(value))
    return { label: "", summary: "", highlights: [], actions: [] };
  return {
    label: text(value.label, 80),
    summary: text(value.summary, 4000) || text(value.digest, 4000),
    highlights: stringList(value.highlights),
    actions: stringList(value.actions ?? value.actionableNotes),
  };
}

export function readAccountExtras(
  raw: Record<string, unknown>,
  profileUrl: string | null,
): AccountExtras {
  const tweetUrls: string[] = [];
  const projects: string[] = [];
  for (const value of [
    raw.tweetUrl,
    raw.statusUrl,
    raw.postUrl,
    raw.xUrl,
    raw.url,
  ])
    pushStatus(tweetUrls, value);
  if (Array.isArray(raw.tweetUrls))
    for (const value of raw.tweetUrls) pushStatus(tweetUrls, value);
  if (Array.isArray(raw.posts)) {
    for (const post of raw.posts) {
      if (!isRecord(post)) continue;
      pushStatus(tweetUrls, post.url ?? post.tweetUrl ?? post.statusUrl);
    }
  }
  if (Array.isArray(raw.projects)) {
    for (const item of raw.projects) {
      if (typeof item !== "string") continue;
      const value = item.trim().slice(0, 80);
      if (!value) continue;
      if (STATUS.test(value)) pushStatus(tweetUrls, value);
      else if (projects.length < 20 && !projects.includes(value))
        projects.push(value);
    }
  }
  return {
    profileUrl,
    projects,
    summary:
      text(raw.summary, 4000) ||
      text(raw.digest, 4000) ||
      text(raw.highlight, 4000),
    tweetUrls: tweetUrls.slice(0, 20),
    reportedAt:
      isoTimestamp(raw.updatedAt) ||
      isoTimestamp(raw.postedAt) ||
      isoTimestamp(raw.generatedAt),
  };
}

export function reportDateFor(meta: SharedFileMeta, now = new Date()) {
  if (meta.explicitDate) return meta.explicitDate;
  const stamp = meta.generatedAt || meta.fileUpdatedAt;
  return shanghaiDay(stamp ? new Date(stamp) : now);
}

export function shanghaiDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function day(value: unknown) {
  return typeof value === "string" && DAY.test(value) ? value : null;
}

export function isoTimestamp(value: unknown) {
  if (typeof value !== "string" || value.length > 40) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function short(value: unknown, max: number) {
  const valueText = text(value, max);
  return valueText || null;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const item of value) {
    const line = text(item, 500);
    if (!line || items.includes(line) || items.length >= 20) continue;
    items.push(line);
  }
  return items;
}

function pushStatus(out: string[], value: unknown) {
  if (
    typeof value !== "string" ||
    !STATUS.test(value.trim()) ||
    out.length >= 20
  )
    return;
  const url = new URL(value.trim());
  url.search = "";
  url.hash = "";
  const normalized = url.toString().replace(/\/$/, "");
  if (!out.includes(normalized)) out.push(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
