import "dotenv/config";
export function readEnv() {
  const port = Number(process.env.PORT || 9010);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Invalid PORT");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith("postgresql://"))
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  const xUserId = process.env.X_USER_ID || "";
  if (xUserId && !/^\d+$/.test(xUserId))
    throw new Error("X_USER_ID must be numeric");
  return {
    port,
    databaseUrl,
    xToken: process.env.X_BEARER_TOKEN || "",
    xUserId,
  };
}
export const env = readEnv();
