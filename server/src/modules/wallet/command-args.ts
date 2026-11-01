import { AppError } from "../../common/http";
export type Command =
  | "status"
  | "address"
  | "balance"
  | "chains"
  | "settings"
  | "signin"
  | "verify"
  | "contractPreview"
  | "contractExecute"
  | "quote"
  | "swap"
  | "orders"
  | "history";
export interface WalletInput {
  chainId?: string;
  from?: string;
  to?: string;
  inputData?: string;
  requestId?: string;
  fromToken?: string;
  toToken?: string;
  amount?: string;
  slippage?: string;
  orderId?: string;
  cursor?: string;
}
export const evmAddress = (v: unknown): v is string =>
  typeof v === "string" &&
  /^0x[0-9a-fA-F]{40}$/.test(v) &&
  !/^0x0{40}$/i.test(v);
export function commandArgs(command: Command, input?: string | WalletInput) {
  const invalid = () => {
    throw new AppError(
      "INVALID_WALLET_ARGUMENT",
      "Invalid wallet command argument",
      400,
    );
  };
  const fixed: Partial<Record<Command, string[]>> = {
    status: ["wallet", "status"],
    address: ["wallet", "address"],
    balance: ["wallet", "balance"],
    chains: ["wallet", "chains"],
    settings: ["wallet", "settings"],
    signin: ["auth", "signin"],
  };
  if (fixed[command]) return [...fixed[command]!, "--json"];
  const id = (v: unknown) => {
    if (typeof v !== "string" || !/^[a-zA-Z0-9_.-]{1,160}$/.test(v))
      return invalid();
    return v;
  };
  if (command === "verify")
    return ["auth", "verify", "--qrCodeId", id(input), "--json"];
  const d = typeof input === "object" ? input : {};
  if (command === "contractExecute")
    return [
      "contract-call",
      "execute",
      "--requestId",
      id(d.requestId),
      "--json",
    ];
  if (command === "history") {
    if (
      d.cursor &&
      (d.cursor.length > 512 ||
        Array.from(d.cursor).some((c) => c.charCodeAt(0) < 32))
    )
      return invalid();
    return [
      "wallet",
      "tx-history",
      "--size",
      "20",
      ...(d.cursor ? ["--nextCursor", d.cursor] : []),
      "--json",
    ];
  }
  if (command === "orders")
    return ["market-order", "list", "--orderId", id(d.orderId), "--json"];
  if (d.chainId !== "56") return invalid();
  if (command === "contractPreview") {
    if (
      !evmAddress(d.from) ||
      !evmAddress(d.to) ||
      !/^0x([a-fA-F0-9]{2}){4,4096}$/.test(d.inputData || "")
    )
      return invalid();
    return [
      "contract-call",
      "preview",
      "--binanceChainId",
      "56",
      "--from",
      d.from,
      "--to",
      d.to,
      "--value",
      "0",
      "--inputData",
      d.inputData!,
      "--json",
    ];
  }
  if (command === "quote" || command === "swap") {
    if (
      !evmAddress(d.fromToken) ||
      !evmAddress(d.toToken) ||
      !/^(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?$/.test(d.amount || "") ||
      Number(d.amount) <= 0
    )
      return invalid();
    const slippage = d.slippage || "auto";
    if (
      slippage !== "auto" &&
      (!/^\d+(\.\d{1,2})?$/.test(slippage) || Number(slippage) > 100)
    )
      return invalid();
    return [
      "market-order",
      command === "swap" ? "swap" : "quote",
      "--binanceChainId",
      "56",
      "--fromToken",
      d.fromToken,
      "--toToken",
      d.toToken,
      "--fromTokenQty",
      d.amount!,
      "--slippage",
      slippage,
      ...(command === "swap" ? ["--mev", "true"] : []),
      "--json",
    ];
  }
  return invalid();
}
