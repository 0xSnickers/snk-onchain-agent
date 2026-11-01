import {
  AGENT_ID_REGISTRY,
  assertControls,
  assertSpend,
  bytecodeHasAgentRegistry,
  classify,
  confirmPhrase,
  DEFAULT_CONTROLS,
  nextStatus,
  shanghaiDayStart,
  usdMicros,
  type SniperObservation,
} from "../src/modules/sniper/sniper-policy";
import { planFeed, projectTarget, type StoredTarget } from "../src/modules/sniper/sniper-feed";
import type { AgentLaunchToken } from "../../packages/contracts/src/launch";

const ready: SniperObservation = {
  exclusiveTemplate: true,
  bytecodeHasRegistry: null,
  stage: "FINALIZING",
  progress: 66,
  agentWallets: 120,
  feeWei: null,
  hasWalletCap: true,
  hasTxCap: null,
  drained: false,
  pooled: null,
  ageMs: 1000,
};

const token = (address: string, stage: AgentLaunchToken["stage"], progress: number | null): AgentLaunchToken => ({
  chain: "bsc",
  address,
  source: "FOUR_AGENT",
  stage,
  symbol: "AID",
  name: "Agent",
  priceUsd: null,
  changePercent: null,
  volumeUsd: null,
  liquidityUsd: null,
  marketCapUsd: null,
  holders: 10,
  platform: "Four.meme Agent ID",
  url: `https://bscscan.com/token/${address}`,
  progress,
  marketAddress: null,
  tokenDeployed: true,
  evidence: "AGENT_ID_TEMPLATE",
});

function stored(address: string, status: StoredTarget["status"], evidence: SniperObservation): StoredTarget {
  return {
    id: "1",
    chainId: "56",
    contractAddress: address,
    symbol: "AID",
    name: "Agent",
    source: "FOUR_EXCLUSIVE",
    stage: evidence.stage,
    kind: "PAID",
    status,
    progress: evidence.progress,
    holders: 10,
    agentWallets: evidence.agentWallets,
    reasons: ["READY"],
    imageUrl: null,
    platform: "Four.meme Agent ID",
    url: `https://bscscan.com/token/${address}`,
    armedAt: null,
    preview: status === "AWAITING_CONFIRM" ? { amount: "1", asset: "USDT", expiresAt: "2099-01-01T00:00:00.000Z" } : null,
    discoveredAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    evidence,
  };
}

describe("sniper policy", () => {
  it("treats a complete paid Agent ID launch as ready and a free one as notify-only", () => {
    expect(classify(ready, DEFAULT_CONTROLS)).toMatchObject({ kind: "PAID", status: "THRESHOLD", reasons: ["READY"] });
    expect(classify({ ...ready, feeWei: "0" }, DEFAULT_CONTROLS)).toMatchObject({
      kind: "FREE",
      status: "NOTIFY_ONLY",
      reasons: ["FREE_NOTIFY_ONLY"],
    });
  });

  it("does not treat missing paid signals as a pass", () => {
    expect(classify({ ...ready, agentWallets: null, hasWalletCap: null, drained: null, progress: null }, DEFAULT_CONTROLS).reasons).toEqual([
      "CAP_UNKNOWN",
      "PROGRESS_UNKNOWN",
      "AGENT_WALLETS_UNKNOWN",
      "DRAINED_UNKNOWN",
    ]);
    expect(classify({ ...ready, hasWalletCap: false, hasTxCap: false }, DEFAULT_CONTROLS).reasons).toEqual(["NO_CAP"]);
    expect(classify({ ...ready, drained: true }, DEFAULT_CONTROLS).reasons).toEqual(["DRAINED"]);
    expect(classify({ ...ready, progress: 64 }, DEFAULT_CONTROLS).reasons).toEqual(["BELOW_PROGRESS"]);
    expect(classify({ ...ready, agentWallets: 99 }, DEFAULT_CONTROLS).reasons).toEqual(["BELOW_WALLETS"]);
  });

  it("skips pooled, old, sold-out and non-agent contracts", () => {
    expect(classify({ ...ready, stage: "MIGRATED" }, DEFAULT_CONTROLS).reasons).toEqual(["ALREADY_POOLED"]);
    expect(classify({ ...ready, ageMs: 49 * 60 * 60 * 1000 }, DEFAULT_CONTROLS).reasons).toEqual(["TOO_OLD"]);
    expect(classify({ ...ready, progress: 100 }, DEFAULT_CONTROLS).reasons).toEqual(["SOLD_OUT"]);
    expect(classify({ ...ready, exclusiveTemplate: false, bytecodeHasRegistry: false }, DEFAULT_CONTROLS)).toMatchObject({
      status: "SKIPPED",
      reasons: ["NOT_AGENT_ID"],
    });
    expect(classify({ ...ready, exclusiveTemplate: false, bytecodeHasRegistry: null }, DEFAULT_CONTROLS).reasons).toEqual([
      "IDENTITY_UNVERIFIED",
    ]);
  });

  it("keeps an armed target only while it stays ready and the global switch is on", () => {
    const classified = classify(ready, DEFAULT_CONTROLS);
    expect(nextStatus("ARMED", classified, true)).toBe("ARMED");
    expect(nextStatus("AWAITING_CONFIRM", classified, false)).toBe("THRESHOLD");
    expect(nextStatus("CONFIRMED", classify({ ...ready, stage: "MIGRATED" }, DEFAULT_CONTROLS), false)).toBe("CONFIRMED");
    expect(nextStatus("ARMED", classify({ ...ready, feeWei: "0" }, DEFAULT_CONTROLS), true)).toBe("NOTIFY_ONLY");
  });

  it("checks the registry bytes, spend caps and the exact confirm phrase", () => {
    expect(bytecodeHasAgentRegistry("0xdead" + AGENT_ID_REGISTRY.slice(2) + "beef")).toBe(true);
    expect(bytecodeHasAgentRegistry("0x")).toBe(false);
    expect(usdMicros("1.5")).toBe(1_500_000n);
    expect(confirmPhrase("1.5")).toBe("确认狙击 1.5 USDT");
    expect(() => assertSpend("0", 20, 0n, 60)).toThrow(/cap/i);
    expect(() => assertSpend("21", 20, 0n, 60)).toThrow(/cap/i);
    try {
      assertSpend("6", 20, 55_000_000n, 60);
      throw new Error("expected daily cap");
    } catch (error) {
      expect(error).toMatchObject({ code: "DAILY_CAP" });
    }
    expect(assertSpend("5", 20, 55_000_000n, 60)).toBe(5_000_000n);
    expect(() => assertControls({ ...DEFAULT_CONTROLS, minProgress: 80 })).toThrow(/bands/);
    expect(() => assertControls({ ...DEFAULT_CONTROLS, maxUsd: 20, dailyUsdCap: 10 })).toThrow(/bands/);
    expect(shanghaiDayStart(new Date("2026-11-01T02:00:00.000Z")).toISOString()).toBe(
      "2026-10-31T16:00:00.000Z",
    );
  });

  it("plans the Four sample without inventing agent-wallet counts or dropping manual signals", () => {
    const address = "0x" + "a".repeat(40);
    const other = "0x" + "b".repeat(40);
    const kept = stored(address, "WATCHING", { ...ready, agentWallets: 130, progress: 10 });
    const manual = { ...stored(other, "WATCHING", ready), source: "MANUAL" as const };
    const writes = planFeed(
      [kept, manual],
      [token(address, "NEW", 12), token(address, "FINALIZING", 70)],
      [],
      DEFAULT_CONTROLS,
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ stage: "FINALIZING", progress: 70, agentWallets: 130, status: "THRESHOLD" });
    expect(projectTarget(null, { ...ready, exclusiveTemplate: false, bytecodeHasRegistry: null }, {
      contractAddress: other,
      source: "MANUAL",
      symbol: "",
      name: "",
      holders: null,
      imageUrl: null,
      platform: "Manual",
      url: "https://bscscan.com/token/" + other,
    }, DEFAULT_CONTROLS).reasons).toEqual(["IDENTITY_UNVERIFIED"]);
  });

  it("marks a previously watched token skipped once the migrated sample includes it", () => {
    const address = "0x" + "c".repeat(40);
    const writes = planFeed([stored(address, "ARMED", ready)], [], [address], { ...DEFAULT_CONTROLS, armed: true });
    expect(writes[0]).toMatchObject({ status: "SKIPPED", reasons: ["ALREADY_POOLED"], preview: null });
  });
});
