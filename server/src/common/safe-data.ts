import { AppError } from "./http";
export const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export const text = (value: unknown, max = 500) =>
  typeof value === "string"
    ? Array.from(value)
        .map((c) => (c.charCodeAt(0) < 32 ? " " : c))
        .join("")
        .slice(0, max)
    : "";
export const decimal = (v: unknown) =>
  (typeof v === "string" || typeof v === "number") &&
  /^\d+(\.\d+)?$/.test(String(v))
    ? String(v).slice(0, 100)
    : null;
export function safeError(error: unknown) {
  return {
    code: error instanceof AppError ? error.code : "INTERNAL_ERROR",
    message:
      error instanceof AppError
        ? text(error.message)
        : "Internal operation failed",
  };
}
export function safeJson(value: unknown, depth = 0): unknown {
  if (depth > 5) return null;
  if (typeof value === "string") return text(value, 2000);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value))
    return value.slice(0, 50).map((v) => safeJson(v, depth + 1));
  return Object.fromEntries(
    Object.entries(object(value))
      .filter(
        ([k]) =>
          !/session.?token|access.?token|refresh.?token|agentsessionid|clientid|secret|password|cookie|authorization|signature|privatekey|seed|mnemonic|stdout|stderr/i.test(
            k,
          ),
      )
      .slice(0, 40)
      .map(([k, v]) => [k, safeJson(v, depth + 1)]),
  );
}
