import { FreeService } from "../src/modules/execution/free.service";
import { BawService } from "../src/modules/wallet/baw.service";
import { AgentStore } from "../src/modules/agent-runs/agent.store";
import { RpcService, FreeProof } from "../src/modules/execution/rpc.service";
import { agentEnv } from "../src/config/agent-env";
const address = "0x" + "1".repeat(40),
  hash = "0x" + "a".repeat(64);
const proof: FreeProof = {
  chainId: "56",
  from: address,
  to: address,
  inputData: "0x12345678",
  value: "0",
  block: "0x1",
  codeHash: "code",
  gasRequiredWei: "1",
  priceFields: [{ method: "price()", value: "0" }],
};
function preview() {
  return {
    requestId: "req",
    parsedTx: { amount: "0" },
    simulationResult: {
      simulationCode: "000000000",
      preCheckCode: "",
      balanceChanges: [],
      allowanceChanges: [],
      authorityChanges: [],
    },
    risks: { riskDetails: [], addresses: {}, riskBehaviors: [] },
    requireConfirmation: false,
    expiresAt: Date.now() + 60000,
  };
}
describe("Free Mint orchestration", () => {
  const original = { ...agentEnv };
  afterEach(() => Object.assign(agentEnv, original));
  function fixture(dev = true) {
    const candidate = {
      id: "candidate",
      class: "FREE_MINT",
      contractAddress: address,
      inputData: "0x12345678",
      autoExecute: false,
    };
    const run = {
      id: "run",
      kind: "FREE_MINT",
      status: "RUNNING",
      candidate,
      contextJson: {},
    };
    const store = {
      candidate: jest.fn().mockResolvedValue(candidate),
      beginCandidate: jest.fn().mockResolvedValue(run),
      action: jest.fn(),
      notify: jest.fn(),
      updateCandidate: jest.fn(),
      updateRun: jest
        .fn()
        .mockImplementation(async (_id, data) => Object.assign(run, data)),
      finish: jest.fn().mockImplementation(async (_id, status) => {
        run.status = status;
      }),
      run: jest.fn().mockResolvedValue(run),
      withLease: async (_key: string, fn: () => Promise<unknown>) => fn(),
      claimExecution: jest.fn().mockImplementation(async () => {
        run.status = "EXECUTING";
      }),
    };
    const baw = {
      run: jest
        .fn()
        .mockImplementation(
          async (command: string) =>
            ({
              status: { status: "CONNECTED" },
              settings: {
                devMode: { enabled: dev, expiresAt: Date.now() / 1000 + 3600 },
              },
              address: { addresses: [{ binanceChainId: "56", address }] },
              contractPreview: preview(),
              contractExecute: {
                status: "BROADCASTED",
                txHash: hash,
                orderId: "order",
              },
            })[command],
        ),
    };
    const rpc = { proveFree: jest.fn().mockResolvedValue(proof) };
    return {
      service: new FreeService(
        baw as unknown as BawService,
        store as unknown as AgentStore,
        rpc as unknown as RpcService,
      ),
      baw,
      store,
      rpc,
      run,
    };
  }
  it("stops before RPC or preview when Developer Mode is off", async () => {
    const f = fixture(false);
    await f.service.prepare("candidate");
    expect(f.rpc.proveFree).not.toHaveBeenCalled();
    expect(f.baw.run).not.toHaveBeenCalledWith(
      "contractPreview",
      expect.anything(),
    );
    expect(f.run.status).toBe("ABORTED");
  });
  it("creates a preview but never broadcasts without a new explicit confirmation", async () => {
    const f = fixture();
    await f.service.prepare("candidate");
    expect(f.run.status).toBe("AWAITING_CONFIRMATION");
    expect(f.baw.run).not.toHaveBeenCalledWith(
      "contractExecute",
      expect.anything(),
    );
  });
  it("broadcast is not marked Minted and the same run cannot execute twice", async () => {
    const f = fixture();
    agentEnv.executionEnabled = true;
    await f.service.prepare("candidate");
    await f.service.execute("run");
    expect(f.run.status).toBe("SUBMITTED");
    await expect(f.service.execute("run")).rejects.toMatchObject({
      code: "CONFIRM_CONSUMED",
    });
    expect(
      f.baw.run.mock.calls.filter((c) => c[0] === "contractExecute"),
    ).toHaveLength(1);
    expect(f.store.updateCandidate).not.toHaveBeenCalledWith("candidate", {
      status: "MINTED",
    });
  });
  it("a broadcast timeout becomes UNKNOWN, never retryable success", async () => {
    const f = fixture();
    agentEnv.executionEnabled = true;
    await f.service.prepare("candidate");
    const originalRun = f.baw.run.getMockImplementation()!;
    f.baw.run.mockImplementation(async (command: string) => {
      if (command === "contractExecute") throw new Error("timeout");
      return originalRun(command);
    });
    await f.service.execute("run");
    expect(f.run.status).toBe("UNKNOWN");
    expect(f.store.updateCandidate).toHaveBeenCalledWith("candidate", {
      status: "EXECUTION_UNKNOWN",
    });
  });
  it("nonzero chain price blocks preview", async () => {
    const f = fixture();
    f.rpc.proveFree.mockRejectedValue(new Error("Not free"));
    await f.service.prepare("candidate");
    expect(f.baw.run).not.toHaveBeenCalledWith(
      "contractPreview",
      expect.anything(),
    );
  });
});
