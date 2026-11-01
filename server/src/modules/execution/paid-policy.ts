import { createHash } from "node:crypto";
import { Audit } from "../research/research.provider";
import { AppError } from "../../common/http";
export const paymentAssets = {
  BNB: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  USDT: "0x55d398326f99059fF775485246999027B3197955",
};
export interface BuyInput {
  amount: string;
  asset: "BNB" | "USDT";
  slippage: string;
  confirmationText: string;
}
export function assertAudit(audit: Audit) {
  if (!audit.available || audit.severity === null)
    throw new AppError(
      "AUDIT_UNAVAILABLE",
      "Supported security audit required before buying",
      409,
    );
  if (audit.severity >= 4 || audit.riskLevel === "HIGH")
    throw new AppError(
      "TOKEN_HIGH_RISK",
      "High risk token; purchase blocked",
      409,
    );
}
export function auditDigest(audit: Audit) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        audit.available,
        audit.severity,
        audit.riskLevel,
        audit.buyTax,
        audit.sellTax,
        audit.hits.map((h) => [h.title, h.description].join(":")).sort(),
        [...audit.cautions].sort(),
      ]),
    )
    .digest("hex");
}
export function validQuote(quote: Record<string, unknown>) {
  return [quote.fromCoinAmount, quote.toCoinAmount].every(
    (v) =>
      typeof v === "string" &&
      /^\d+(\.\d+)?$/.test(v) &&
      Number.isFinite(Number(v)) &&
      Number(v) > 0,
  );
}
