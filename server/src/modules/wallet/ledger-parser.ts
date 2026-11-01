import { AppError } from "../../common/http";
export const bscScope = (address: string) => "EVM:" + address.toLowerCase();
export function normalizeLedgerScope(value: unknown): string | null {
  return typeof value === "string" &&
    /^EVM:0x(?!0{40}$)[0-9a-f]{40}$/i.test(value)
    ? bscScope(value.slice(4))
    : null;
}
export interface LedgerContract {
  address: string;
  name: string;
}
export function parseMintLedger(value: unknown) {
  const doc = value as {
    schema?: string;
    walletAddress?: unknown;
    walletScope?: unknown;
    mints?: {
      contractAddress?: unknown;
      name?: string;
      symbol?: string;
      walletScope?: unknown;
    }[];
  };
  const address =
    typeof doc.walletAddress === "string"
      ? doc.walletAddress.toLowerCase()
      : "";
  if (!/^0x(?!0{40}$)[0-9a-f]{40}$/.test(address))
    throw new AppError(
      "LEDGER_INVALID",
      "Mint ledger wallet address is invalid",
      409,
    );
  const scope = bscScope(address);
  if (
    doc.walletScope !== undefined &&
    normalizeLedgerScope(doc.walletScope) !== scope
  )
    throw new AppError(
      "LEDGER_INVALID",
      "Mint ledger wallet scope does not match the address",
      409,
    );
  if (doc.mints !== undefined && !Array.isArray(doc.mints))
    throw new AppError(
      "LEDGER_INVALID",
      "Mint ledger entries are invalid",
      409,
    );
  const contracts = new Map<string, LedgerContract>();
  for (const mint of doc.mints || []) {
    if (mint.walletScope !== undefined) {
      const rowScope = normalizeLedgerScope(mint.walletScope);
      if (!rowScope)
        throw new AppError(
          "LEDGER_INVALID",
          "Mint entry wallet scope is invalid",
          409,
        );
      if (rowScope !== scope) continue;
    }
    const contract = String(mint.contractAddress || "").toLowerCase();
    if (!/^0x(?!0{40}$)[0-9a-f]{40}$/.test(contract) || contracts.has(contract))
      continue;
    contracts.set(contract, {
      address: contract,
      name: mint.name || mint.symbol || "Token",
    });
  }
  return { scope, address, contracts: [...contracts.values()] };
}
