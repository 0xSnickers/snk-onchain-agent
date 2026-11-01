import type {
  AgentLaunchToken,
  LaunchSource,
  LaunchStage,
} from "../../../../packages/contracts/src/launch";
import { AppError } from "../../common/http";
export type Row = Record<string, unknown>;
export function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError("LAUNCH_INVALID_RESPONSE", "Invalid launchpad response");
  return value as Row;
}
export function number(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value !== "number" && typeof value !== "string")
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function address(value: unknown): string | null {
  return typeof value === "string" &&
    /^0x[0-9a-f]{40}$/i.test(value) &&
    !/^0x0{40}$/i.test(value)
    ? value.toLowerCase()
    : null;
}
export function image(value: unknown, base?: string): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const u = new URL(value, base);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function token(
  source: LaunchSource,
  stage: LaunchStage,
  a: string,
): AgentLaunchToken {
  return {
    chain: "bsc",
    address: a,
    source,
    stage,
    symbol: "",
    name: "",
    priceUsd: null,
    changePercent: null,
    volumeUsd: null,
    liquidityUsd: null,
    marketCapUsd: null,
    holders: null,
    platform: source,
    imageUrl: null,
    progress: null,
    marketAddress: null,
    tokenDeployed: true,
    evidence:
      source === "FOUR_AGENT"
        ? "AGENT_ID_TEMPLATE"
        : source === "FLAP_AGENT"
          ? "FLAP_AGENT_READER"
          : "AGENT_PLATFORM",
    url: `https://bscscan.com/token/${a}`,
  };
}
