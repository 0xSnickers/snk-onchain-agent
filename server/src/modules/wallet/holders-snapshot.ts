import { readFileSync } from "node:fs";
import { join } from "node:path";

export type HolderConfidence = "high" | "ok" | "lower_bound" | "unknown";
export interface HolderMeta {
  holders: number | null;
  holdersConfidence: HolderConfidence | null;
  note: string | null;
}
export interface HoldersSnapshot {
  fetchedAt: string;
  byAddress: Map<string, HolderMeta>;
}
const confidences = new Set<HolderConfidence>(["high", "ok", "lower_bound", "unknown"]);

export function parseHoldersSnapshot(text: string): HoldersSnapshot | null {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== "object") return null;
  const record = doc as { queriedAtISO?: unknown; results?: unknown };
  if (typeof record.queriedAtISO !== "string" || !Array.isArray(record.results)) return null;
  const byAddress = new Map<string, HolderMeta>();
  for (const row of record.results) {
    if (!row || typeof row !== "object") continue;
    const item = row as {
      contract?: unknown;
      holders?: unknown;
      confidence?: unknown;
      note?: unknown;
    };
    const address = String(item.contract || "").toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address)) continue;
    const holders =
      typeof item.holders === "number" && Number.isInteger(item.holders) && item.holders >= 0
        ? item.holders
        : null;
    const holdersConfidence =
      typeof item.confidence === "string" && confidences.has(item.confidence as HolderConfidence)
        ? (item.confidence as HolderConfidence)
        : null;
    const note =
      typeof item.note === "string" ? item.note.replace(/\s+/g, " ").trim().slice(0, 180) : "";
    byAddress.set(address, { holders, holdersConfidence, note: note || null });
  }
  return { fetchedAt: record.queriedAtISO, byAddress };
}

export function readHoldersSnapshot(): HoldersSnapshot | null {
  const paths = [
    join(process.cwd(), "data", "nft-holders-result.json"),
    join(process.cwd(), "..", "data", "nft-holders-result.json"),
  ];
  for (const path of paths) {
    try {
      const parsed = parseHoldersSnapshot(readFileSync(path, "utf8"));
      if (parsed) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

export function holderMeta(snapshot: HoldersSnapshot | null, address: string | null): HolderMeta {
  const empty: HolderMeta = { holders: null, holdersConfidence: null, note: null };
  if (!snapshot || !address) return empty;
  return snapshot.byAddress.get(address.toLowerCase()) || empty;
}
