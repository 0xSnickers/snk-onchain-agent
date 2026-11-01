import type { AgentLaunchToken } from "../../packages/contracts/src/launch";
import { SniperService } from "../src/modules/sniper/sniper.service";
import { DEFAULT_CONTROLS, type SniperObservation } from "../src/modules/sniper/sniper-policy";
import type { FeedWrite, StoredTarget } from "../src/modules/sniper/sniper-feed";
import type { SniperControls, SniperIntent } from "../../packages/contracts/src/sniper";
import type { LaunchHttpProvider } from "../src/modules/market/launch-http.provider";
import type { SniperRepository } from "../src/modules/sniper/sniper.repository";
import type { SniperRpc } from "../src/modules/sniper/sniper-rpc";

const ready: SniperObservation = {
  exclusiveTemplate: true,
  bytecodeHasRegistry: null,
  stage: "FINALIZING",
  progress: 66,
  agentWallets: 120,
  feeWei: null,
  hasWalletCap: true,
  hasTxCap: false,
  drained: false,
  pooled: null,
  ageMs: 1000,
};

function token(address: string, stage: AgentLaunchToken["stage"]): AgentLaunchToken {
  return {
    chain: "bsc",
    address,
    source: "FOUR_AGENT",
    stage,
    symbol: "AID",
    name: "Agent ID",
    priceUsd: null,
    changePercent: null,
    volumeUsd: null,
    liquidityUsd: null,
    marketCapUsd: null,
    holders: 4,
    platform: "Four.meme Agent ID",
    url: `https://bscscan.com/token/${address}`,
    progress: 40,
    marketAddress: null,
    tokenDeployed: true,
    evidence: "AGENT_ID_TEMPLATE",
  };
}

class Memory {
  controls: SniperControls = { ...DEFAULT_CONTROLS };
  rows: StoredTarget[] = [];
  intents: SniperIntent[] = [];
  spent = 0n;
  control() {
    return Promise.resolve({ ...this.controls });
  }
  writeControl(controls: SniperControls) {
    this.controls = { ...controls };
    return this.control();
  }
  list() {
    return Promise.resolve(this.rows.map((row) => structuredClone(row)));
  }
  find(id: string) {
    return Promise.resolve(structuredClone(this.rows.find((row) => row.id === id) ?? null));
  }
  findByAddress(contractAddress: string) {
    return Promise.resolve(structuredClone(this.rows.find((row) => row.contractAddress === contractAddress) ?? null));
  }
  upsertAll(writes: FeedWrite[]) {
    for (const write of writes) {
      const prev = this.rows.find((row) => row.contractAddress === write.contractAddress);
      const next: StoredTarget = {
        id: prev?.id ?? `id-${write.contractAddress.slice(2, 8)}`,
        chainId: "56",
        contractAddress: write.contractAddress,
        symbol: write.symbol,
        name: write.name,
        source: write.source,
        stage: write.stage,
        kind: write.kind,
        status: write.status,
        progress: write.progress,
        holders: write.holders,
        agentWallets: write.agentWallets,
        reasons: write.reasons,
        imageUrl: write.imageUrl,
        platform: write.platform,
        url: write.url,
        armedAt: prev?.armedAt ?? null,
        preview: write.preview,
        discoveredAt: prev?.discoveredAt ?? "2026-11-01T00:00:00.000Z",
        updatedAt: "2026-11-01T00:00:00.000Z",
        evidence: write.evidence,
      };
      if (prev) Object.assign(prev, next);
      else this.rows.push(next);
    }
    return Promise.resolve();
  }
  armThreshold(id: string) {
    if (!this.controls.armed) return Promise.resolve("disarmed" as const);
    const row = this.rows.find((item) => item.id === id);
    if (!row || row.status !== "THRESHOLD") return Promise.resolve("blocked" as const);
    row.status = "ARMED";
    row.armedAt = "2026-11-01T01:00:00.000Z";
    row.preview = null;
    return Promise.resolve(structuredClone(row));
  }
  compare(id: string, from: string[], patch: { status: StoredTarget["status"]; preview: StoredTarget["preview"] }) {
    const row = this.rows.find((item) => item.id === id && from.includes(item.status));
    if (!row) return Promise.resolve(null);
    row.status = patch.status;
    row.preview = patch.preview;
    return Promise.resolve(structuredClone(row));
  }
  consume(id: string, input: { amount: string; confirmationText: string }) {
    const row = this.rows.find((item) => item.id === id && item.status === "AWAITING_CONFIRM");
    if (!row) return Promise.resolve(null);
    row.status = "CONFIRMED";
    row.preview = null;
    const intent: SniperIntent = {
      id: `intent-${this.intents.length + 1}`,
      targetId: id,
      amount: input.amount,
      asset: "USDT",
      confirmationText: input.confirmationText,
      status: "RECORDED",
      broadcast: false,
      reason: "WALLET_DELEGATED",
      createdAt: "2026-11-01T02:00:00.000Z",
    };
    this.intents.push(intent);
    return Promise.resolve(intent);
  }
  spentMicros() {
    return Promise.resolve(this.spent);
  }
}

function serviceFor(memory: Memory, four: jest.Mock, registryPresent = jest.fn()) {
  return new SniperService(
    memory as unknown as SniperRepository,
    { four } as unknown as LaunchHttpProvider,
    { registryPresent } as unknown as SniperRpc,
  );
}

describe("sniper service", () => {
  const address = "0x" + "1".repeat(40);

  it("lists the exclusive sample and keeps a failed refresh from wiping stored rows", async () => {
    const memory = new Memory();
    const four = jest.fn(async (stage: string) => (stage === "FINALIZING" ? [token(address, "FINALIZING")] : []));
    const service = serviceFor(memory, four);
    const board = await service.board();
    expect(board.broadcast).toBe(false);
    expect(board.targets).toHaveLength(1);
    expect(board.targets[0]).toMatchObject({
      source: "FOUR_EXCLUSIVE",
      status: "WATCHING",
      agentWallets: null,
      reasons: expect.arrayContaining(["AGENT_WALLETS_UNKNOWN", "CAP_UNKNOWN", "DRAINED_UNKNOWN"]),
    });
    expect(board.targets[0].signals.exclusiveTemplate).toBe(true);
    four.mockRejectedValue(new Error("secret-rpc"));
    const stale = await serviceFor(memory, four).board();
    expect(stale.refreshError?.code).toBe("SNIPER_UPSTREAM_ERROR");
    expect(stale.refreshError?.message).not.toContain("secret");
    expect(stale.targets).toHaveLength(1);
  });

  it("returns an error instead of an empty success when the watch feed is down", async () => {
    const four = jest.fn().mockRejectedValue(new Error("down"));
    await expect(serviceFor(new Memory(), four).board()).rejects.toMatchObject({ code: "SNIPER_UPSTREAM_ERROR" });
  });

  it("does not broadcast, and consumes one exact confirmation", async () => {
    const memory = new Memory();
    memory.controls = { ...DEFAULT_CONTROLS, armed: true };
    memory.rows.push({
      id: "target-1",
      chainId: "56",
      contractAddress: address,
      symbol: "AID",
      name: "Agent",
      source: "FOUR_EXCLUSIVE",
      stage: "FINALIZING",
      kind: "PAID",
      status: "AWAITING_CONFIRM",
      progress: 66,
      holders: 4,
      agentWallets: 120,
      reasons: ["READY"],
      imageUrl: null,
      platform: "Four.meme Agent ID",
      url: "https://bscscan.com/token/" + address,
      armedAt: "2026-11-01T01:00:00.000Z",
      preview: { amount: "5", asset: "USDT", expiresAt: "2099-01-01T00:00:00.000Z" },
      discoveredAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
      evidence: ready,
    });
    const service = serviceFor(memory, jest.fn());
    await expect(
      service.confirm("target-1", { amount: "5", asset: "USDT", confirmationText: "确认买入 5 USDT" }),
    ).rejects.toMatchObject({ code: "CONFIRM_REQUIRED" });
    expect(memory.intents).toHaveLength(0);
    const intent = await service.confirm("target-1", {
      amount: "5",
      asset: "USDT",
      confirmationText: "确认狙击 5 USDT",
    });
    expect(intent).toMatchObject({ broadcast: false, reason: "WALLET_DELEGATED", status: "RECORDED" });
    expect(memory.rows[0].status).toBe("CONFIRMED");
    await expect(
      service.confirm("target-1", { amount: "5", asset: "USDT", confirmationText: "确认狙击 5 USDT" }),
    ).rejects.toMatchObject({ code: "CONFIRM_CONSUMED" });
  });

  it("blocks preview while disarmed and enforces the daily cap", async () => {
    const memory = new Memory();
    memory.rows.push({
      id: "target-1",
      chainId: "56",
      contractAddress: address,
      symbol: "",
      name: "",
      source: "MANUAL",
      stage: "UNKNOWN",
      kind: "PAID",
      status: "ARMED",
      progress: 66,
      holders: null,
      agentWallets: 120,
      reasons: ["READY"],
      imageUrl: null,
      platform: "Manual",
      url: "https://bscscan.com",
      armedAt: null,
      preview: null,
      discoveredAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
      evidence: ready,
    });
    const service = serviceFor(memory, jest.fn());
    await expect(service.preview("target-1", "1")).rejects.toMatchObject({ code: "SNIPER_DISARMED" });
    memory.controls.armed = true;
    memory.spent = 55_000_000n;
    await expect(service.preview("target-1", "6")).rejects.toMatchObject({ code: "DAILY_CAP" });
    const preview = await service.preview("target-1", "5");
    expect(preview).toMatchObject({ status: "AWAITING_CONFIRM", preview: { amount: "5", asset: "USDT" } });
  });

  it("arms only a ready target after the global switch is on, and manual adds do not invent identity", async () => {
    const memory = new Memory();
    memory.rows.push({
      id: "target-1",
      chainId: "56",
      contractAddress: address,
      symbol: "AID",
      name: "Agent",
      source: "MANUAL",
      stage: "FINALIZING",
      kind: "PAID",
      status: "THRESHOLD",
      progress: 66,
      holders: null,
      agentWallets: 120,
      reasons: ["READY"],
      imageUrl: null,
      platform: "Manual",
      url: "https://bscscan.com",
      armedAt: null,
      preview: null,
      discoveredAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
      evidence: ready,
    });
    const registry = jest.fn(async (): Promise<boolean | null> => false);
    const service = serviceFor(memory, jest.fn(async () => []), registry);
    await expect(service.arm("target-1")).rejects.toMatchObject({ code: "SNIPER_DISARMED" });
    const board = await service.updateControls({ ...DEFAULT_CONTROLS, armed: true });
    expect(board.controls.armed).toBe(true);
    expect(board.targets[0].status).toBe("THRESHOLD");
    expect(await service.arm("target-1")).toMatchObject({ status: "ARMED" });
    const manual = "0x" + "2".repeat(40);
    expect(await service.add(manual)).toMatchObject({ status: "SKIPPED", reasons: ["NOT_AGENT_ID"] });
    registry.mockResolvedValue(null);
    const unverified = "0x" + "3".repeat(40);
    expect(await service.add(unverified)).toMatchObject({ status: "WATCHING", reasons: ["IDENTITY_UNVERIFIED"] });
  });
});
