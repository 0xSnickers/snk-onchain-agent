import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AppError } from "../../common/http";

import { parseMintLedger } from "./ledger-parser";
export { bscScope, type LedgerContract } from "./ledger-parser";

export function refuseLiveWallet(): never {
  throw new AppError(
    "WALLET_DELEGATED",
    "Agent Wallet stays with Grok Bot. This app does not sign in or broadcast.",
    409,
  );
}

export function readLedger() {
  const paths = [
    join(process.cwd(), "data", "baw-free-mints.json"),
    join(process.cwd(), "..", "data", "baw-free-mints.json"),
  ];
  for (const path of paths) {
    try {
      const doc = JSON.parse(readFileSync(path, "utf8")) as {
        schema?: string;
        walletAddress?: string;
        walletScope?: string;
        mints?: {
          contractAddress?: string;
          name?: string;
          symbol?: string;
          walletScope?: string;
        }[];
      };
      if (doc.schema !== "snk-onchain-agent/baw-free-mints@1") continue;
      return parseMintLedger(doc);
    } catch (error) {
      if (error instanceof AppError) throw error;
    }
  }
  throw new AppError(
    "LEDGER_MISSING",
    "No imported mint ledger. After Grok Bot writes data/baw-free-mints.json, run npm run import:baw-mints.",
    409,
  );
}
export function readLedgerIdentity() {
  const ledger = readLedger();
  return {
    scope: ledger.scope,
    address: ledger.address,
    addresses: [
      { binanceChainId: "56", chainName: "BSC", address: ledger.address },
    ],
  };
}
