import "dotenv/config";
import { AppError } from "../common/http";
function bool(name: string, fallback = false) {
  const v = process.env[name];
  if (v && !["true", "false"].includes(v))
    throw new Error(`${name} must be true or false`);
  return v ? v === "true" : fallback;
}
function integer(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`Invalid ${name}`);
  return value;
}
const rpc = process.env.BSC_RPC_URL || "";
if (rpc) {
  const u = new URL(rpc);
  if (
    u.protocol !== "https:" &&
    !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))
  )
    throw new Error("BSC_RPC_URL must be HTTPS or loopback");
}
const maxGasWei = process.env.MINT_MAX_GAS_WEI || "1000000000000000";
if (!/^\d+$/.test(maxGasWei) || BigInt(maxGasWei) <= 0n)
  throw new Error("Invalid MINT_MAX_GAS_WEI");
export const agentEnv = {
  enabled: bool("MINT_MONITOR_ENABLED"),
  executionEnabled: bool("AGENT_EXECUTION_ENABLED"),
  autoFree: bool("MINT_AUTO_EXECUTE"),
  discoveryEnabled: bool("MEME_DISCOVERY_ENABLED"),
  socialEnabled: bool("SOCIAL_RESEARCH_ENABLED"),
  intervalMs: integer("MINT_MONITOR_INTERVAL_MS", 1800000, 300000, 86400000),
  batchSize: integer("MINT_MONITOR_BATCH_SIZE", 5, 1, 20),
  chainIds: process.env.MINT_MONITOR_CHAIN_IDS || "56",
  bawPath: process.env.BAW_PATH || "baw",
  rpc,
  maxGasWei,
};
if (agentEnv.chainIds !== "56")
  throw new Error("First release supports MINT_MONITOR_CHAIN_IDS=56");
export function requireExecution() {
  if (!agentEnv.executionEnabled)
    throw new AppError(
      "EXECUTION_DISABLED",
      "Live execution is disabled. Enable AGENT_EXECUTION_ENABLED explicitly to broadcast.",
      409,
    );
}
