import { DelegationService } from "../src/modules/delegation/delegation.service";
import {
  DelegationRepository,
  assertOnline,
} from "../src/modules/delegation/delegation.repository";
import { FairMintProvider } from "../src/modules/delegation/detection.provider";
import { AgentStore } from "../src/modules/agent-runs/agent.store";
import { DelegatedResultService } from "../src/modules/delegation/result.service";
import { RpcService } from "../src/modules/execution/rpc.service";
const address = "0x" + "1".repeat(40),
  scope = `EVM:${address}`;
describe("Delegated classification and authorization", () => {
  const candidate = {
    id: "candidate",
    class: "FREE_MINT",
    inputData: "0x12345678",
    contractAddress: address,
    source: "external-fair-mint",
    status: "DISCOVERED",
  };
  const gates = { priceWei: "0", holders: 101, holdersVerified: true };
  let repo: {
    enqueue: jest.Mock;
    selectExecutor: jest.Mock;
    queued: jest.Mock;
    markQueued: jest.Mock;
    db: { executorSession: { findUnique: jest.Mock } };
  };
  let store: {
    candidate: jest.Mock;
    updateCandidate: jest.Mock;
    brief: jest.Mock;
  };
  let fair: { gates: jest.Mock };
  let service: DelegationService;
  beforeEach(() => {
    repo = {
      markQueued: jest.fn(),
      selectExecutor: jest
        .fn()
        .mockImplementation(async (kind, id, walletScope) => {
          if (walletScope && walletScope !== scope)
            throw Object.assign(new Error("Wallet mismatch"), {
              code: "WALLET_CHANGED",
            });
          return {
            id: id || (kind === "FREE_MINT" ? "w3" : "w4"),
            walletScope: scope,
          };
        }),
      queued: jest.fn().mockResolvedValue(null),
      enqueue: jest
        .fn()
        .mockImplementation((d) => ({ ...d, id: "outbox", status: "PENDING" })),
      db: {
        executorSession: {
          findUnique: jest.fn().mockResolvedValue({ walletScope: scope }),
        },
      },
    };
    store = {
      candidate: jest.fn().mockResolvedValue(candidate),
      updateCandidate: jest.fn(),
      brief: jest.fn(),
    };
    fair = { gates: jest.fn().mockResolvedValue(gates) };
    service = new DelegationService(
      repo as unknown as DelegationRepository,
      fair as unknown as FairMintProvider,
      store as unknown as AgentStore,
    );
  });
  it("routes verified free candidates to a configured dynamic executor, requiring remote preview", async () => {
    const row = await service.queue("candidate");
    expect(row).toMatchObject({
      kind: "FREE_MINT",
      executorId: "w3",
      walletScope: scope,
    });
  });
  it.each([
    { holders: 100 },
    { holders: null },
    { holdersVerified: false },
    { priceWei: null },
    { priceWei: "1" },
  ])("defaults uncertain/paid candidates to research: %p", async (change) => {
    fair.gates.mockResolvedValue({ ...gates, ...change });
    expect(await service.queue("candidate")).toMatchObject({
      kind: "PAID_RESEARCH",
      executorId: "w4",
    });
  });
  it("does not conceal provider failures or replay unknown execution", async () => {
    fair.gates.mockRejectedValueOnce(new Error("RPC unavailable"));
    await expect(service.queue("candidate")).rejects.toThrow("RPC unavailable");
    expect(repo.enqueue).not.toHaveBeenCalled();
    store.candidate.mockResolvedValue({
      ...candidate,
      status: "EXECUTION_UNKNOWN",
    });
    await expect(service.queue("candidate")).rejects.toMatchObject({
      code: "CANDIDATE_PROCESSED",
    });
  });
  it("rejects vague or zero confirmations before creating paid work", async () => {
    for (const input of [
      { amount: "1", confirmationText: "买一点" },
      { amount: "0", confirmationText: "确认买入 0 BNB" },
    ]) {
      await expect(
        service.confirm("brief", {
          ...input,
          asset: "BNB",
          slippage: "auto",
          walletScope: scope,
        }),
      ).rejects.toMatchObject({ code: "CONFIRM_REQUIRED" });
    }
    expect(repo.enqueue).not.toHaveBeenCalled();
  });
  it("records exact paid intent while w2 is offline, bound to its wallet", async () => {
    store.brief.mockResolvedValue({
      candidateId: "candidate",
      contractAddress: address,
      candidate,
      auditAvailable: true,
      dynamicAvailable: true,
      createdAt: new Date(),
      riskLevel: "LOW",
      evidenceJson: { audit: { available: true, severity: 1 } },
    });
    const input = {
      amount: "0.01",
      asset: "BNB" as const,
      slippage: "auto",
      walletScope: scope,
      confirmationText: "确认买入 0.01 BNB",
    };
    expect(await service.confirm("brief", input)).toMatchObject({
      kind: "PAID_BUY",
      executorId: "w4",
      confirmation: expect.objectContaining({
        confirmationText: input.confirmationText,
      }),
    });
    await expect(
      service.confirm("brief", { ...input, walletScope: "EVM:other" }),
    ).rejects.toMatchObject({ code: "WALLET_CHANGED" });
  });
  it("keeps an existing task bound when the default changes", async () => {
    repo.queued.mockResolvedValue({
      id: "queued",
      executorId: "w17",
      kind: "FREE_MINT",
      status: "PENDING",
    });
    expect(await service.queue("candidate")).toMatchObject({
      executorId: "w17",
    });
    expect(repo.selectExecutor).not.toHaveBeenCalled();
    await expect(service.queue("candidate", "w18")).rejects.toMatchObject({
      code: "OUTBOX_BOUND",
    });
  });
  it("stale, paused or disconnected sessions cannot execute", () => {
    for (const s of [
      null,
      { state: "UNCONNECTED", paused: false, heartbeatAt: new Date() },
      { state: "CONNECTED", paused: true, heartbeatAt: new Date() },
      { state: "CONNECTED", paused: false, heartbeatAt: new Date(0) },
    ])
      expect(() => assertOnline(s)).toThrow();
  });
});
describe("Delegated result boundaries", () => {
  const row = {
    walletScope: scope,
    executorId: "w1",
    claimToken: "token",
    runId: "run",
    candidateId: "candidate",
    kind: "FREE_MINT",
    status: "CLAIMED",
    txHash: null,
    payload: { inputData: "0x12345678" },
  };
  const hash = "0x" + "a".repeat(64);
  const input = {
    walletScope: scope,
    executorId: "w1",
    claimToken: "token",
    status: "SUCCEEDED",
    txHash: hash,
    previewClean: true,
    priceWei: "0",
    holders: 101,
    previewRequestId: "fixture",
  };
  function setup(change = {}) {
    const repo = {
      find: jest.fn().mockResolvedValue({ ...row, ...change }),
      db: {
        candidateOutbox: {
          findUnique: jest.fn().mockResolvedValue({ ...row, ...change }),
        },
        $transaction: jest.fn(),
      },
    };
    const rpc = {
      call: jest.fn().mockResolvedValueOnce("0x38").mockResolvedValue({
        from: address,
        to: address,
        value: "0x1",
        input: "0x12345678",
      }),
      receipt: jest.fn().mockResolvedValue({ status: "0x1" }),
    };
    const store = {
      candidate: jest.fn().mockResolvedValue({ contractAddress: address }),
    };
    return {
      repo,
      service: new DelegatedResultService(
        repo as unknown as DelegationRepository,
        rpc as unknown as RpcService,
        store as unknown as AgentStore,
      ),
    };
  }
  it("rejects wrong scope/token before touching chain or database writes", async () => {
    const { service, repo } = setup();
    await expect(
      service.result("id", { ...input, walletScope: "other" }),
    ).rejects.toMatchObject({ code: "OUTBOX_NOT_FOUND" });
    expect(repo.db.$transaction).not.toHaveBeenCalled();
  });
  it("cannot declare nonzero value a successful free mint", async () => {
    const { service, repo } = setup();
    await expect(service.result("id", input)).rejects.toMatchObject({
      code: "RESULT_UNVERIFIED",
    });
    expect(repo.db.$transaction).not.toHaveBeenCalled();
  });
  it("research never authorizes a transaction", async () => {
    const { service } = setup({ kind: "PAID_RESEARCH" });
    await expect(service.result("id", input)).rejects.toMatchObject({
      code: "UNAUTHORIZED_SPEND",
    });
  });
});
