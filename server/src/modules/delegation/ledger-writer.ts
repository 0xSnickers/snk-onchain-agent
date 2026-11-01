import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { normalizeLedgerScope } from "../wallet/ledger-parser";
import { AppError } from "../../common/http";
export async function appendLedger(mint: Record<string, unknown>) {
  const path = resolve(
    process.env.BAW_MINT_LEDGER_PATH ||
      (process.cwd().endsWith("/server")
        ? "../data/baw-free-mints.json"
        : "data/baw-free-mints.json"),
  );
  let doc: {
    schema: string;
    walletScope?: string;
    walletAddress?: string;
    mints: Record<string, unknown>[];
  };
  try {
    doc = JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      throw new AppError(
        "LEDGER_SYNC_FAILED",
        "Existing mint ledger is unreadable; database result retained",
        502,
      );
    doc = {
      schema: "snk-onchain-agent/baw-free-mints@1",
      walletScope: String(mint.walletScope),
      walletAddress: String(mint.walletScope).slice(4),
      mints: [],
    };
  }
  if (
    doc.schema !== "snk-onchain-agent/baw-free-mints@1" ||
    !Array.isArray(doc.mints)
  )
    throw new AppError(
      "LEDGER_SYNC_FAILED",
      "Invalid mint ledger; database result retained",
      502,
    );
  if (
    !doc.mints.some(
      (m) =>
        String(m.txHash).toLowerCase() === mint.txHash &&
        normalizeLedgerScope(m.walletScope || doc.walletScope) ===
          normalizeLedgerScope(mint.walletScope),
    )
  )
    doc.mints.push(mint);
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(doc, null, 2) + "\n", { mode: 0o600 });
  await rename(temp, path);
}
