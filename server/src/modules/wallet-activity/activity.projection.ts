import { object, text } from "../../common/safe-data";
export function units(raw: unknown, decimals: unknown) {
  if (
    typeof raw !== "string" ||
    !/^\d+$/.test(raw) ||
    !Number.isInteger(decimals) ||
    Number(decimals) < 0 ||
    Number(decimals) > 36
  )
    return null;
  const d = Number(decimals),
    v = raw.padStart(d + 1, "0");
  return d
    ? `${v.slice(0, -d)}.${v.slice(-d)}`.replace(/\.?0+$/, "") || "0"
    : BigInt(raw).toString();
}
export function projectTransactions(
  transactions: unknown[],
  identity: {
    scope: string;
    addresses: { binanceChainId: string; address: string }[];
  },
) {
  const rows: {
    walletScope: string;
    walletAddress: string;
    chainId: string;
    txHash: string;
    type: string;
    providerType: string;
    status: string;
    txTime: Date | null;
    movements: Record<string, unknown>[];
    networkFee: Record<string, unknown>;
  }[] = [];
  for (const entry of transactions.map(object)) {
    const type = text(entry.txType, 60).toLowerCase();
    const list =
      Array.isArray(entry.txHashList) && entry.txHashList.length
        ? entry.txHashList
        : [entry];
    for (const item of list.map(object)) {
      const chainId = text(item.binanceChainId || entry.binanceChainId, 20),
        hash = text(item.txHash || entry.txHash, 100);
      const address = identity.addresses.find(
        (a) => a.binanceChainId === chainId,
      )?.address;
      if (
        !address ||
        !(
          chainId === "CT_501"
            ? /^[1-9A-HJ-NP-Za-km-z]{64,100}$/
            : /^0x[0-9a-f]{64}$/i
        ).test(hash)
      )
        continue;
      const instructions = object(item.instructions),
        fee = object(item.networkFee);
      const movements = ["send", "receive"].flatMap((direction) =>
        (Array.isArray(instructions[direction])
          ? (instructions[direction] as unknown[])
          : []
        )
          .slice(0, 30)
          .map(object)
          .map((m) => {
            const token = object(m.tokenInfo),
              counterparty = object(m.addressInfo);
            return {
              direction,
              symbol: text(token.symbol, 50),
              tokenAddress: text(token.contractAddress, 100),
              amount: units(m.amount, token.decimals),
              rawAmount:
                typeof m.amount === "string" ? text(m.amount, 100) : null,
              counterparty: text(counterparty.address, 100),
            };
          }),
      );
      const numeric = Number(entry.txTime);
      const time =
        typeof entry.txTime === "string" && !/^\d+$/.test(entry.txTime)
          ? Date.parse(entry.txTime)
          : numeric > 0
            ? numeric < 1e12
              ? numeric * 1000
              : numeric
            : NaN;
      rows.push({
        walletScope: identity.scope,
        walletAddress: address,
        chainId,
        txHash: hash,
        type: type.includes("mint")
          ? "MINT"
          : /swap|trade|buy|sell/.test(type)
            ? "TRADE"
            : /send|receive|transfer/.test(type)
              ? "TRANSFER"
              : "CONTRACT",
        providerType: type || "unknown",
        status: text(item.status || entry.status || "unknown", 40),
        txTime: Number.isFinite(time) ? new Date(time) : null,
        movements,
        networkFee: {
          symbol: text(fee.feeTokenSymbol, 50),
          tokenAddress: text(fee.feeTokenAddress, 100),
          rawAmount: text(fee.feeValue, 100),
          decimals:
            typeof fee.feeTokenDecimals === "number"
              ? fee.feeTokenDecimals
              : null,
        },
      });
    }
  }
  return rows;
}
