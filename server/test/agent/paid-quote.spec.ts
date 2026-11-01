import { PaidService } from "../../src/modules/execution/paid.service";
import { AgentStore } from "../../src/modules/agent-runs/agent.store";
import { BawService } from "../../src/modules/wallet/baw.service";
import { ResearchProvider } from "../../src/modules/research/research.provider";
import { agentEnv } from "../../src/config/agent-env";
const address = "0x" + "1".repeat(40),
  target = "0x" + "2".repeat(40);
const cleanAudit = {
  available: true,
  riskLevel: "LOW",
  severity: 1,
  buyTax: "0",
  sellTax: "0",
  hits: [],
  cautions: [],
};
describe("Quote-bound paid execution", () => {
  const original = { ...agentEnv };
  afterEach(() => Object.assign(agentEnv, original));
  function fixture() {
    const run = {
      id: "run",
      kind: "PAID_BUY",
      status: "RUNNING",
      candidateId: "candidate",
      contextJson: {},
      confirmations: [] as Record<string, unknown>[],
    };
    const store = {
      brief: async () => ({
        auditAvailable: true,
        dynamicAvailable: true,
        createdAt: new Date(),
        candidateId: "candidate",
        chainId: "56",
        contractAddress: target,
      }),
      expire: jest.fn(),
      beginCandidate: async () => run,
      updateRun: async (_id: string, data: Record<string, unknown>) =>
        Object.assign(run, data),
      action: jest.fn(),
      updateCandidate: jest.fn(),
      run: async () => run,
      finish: async (_id: string, status: string) => {
        run.status = status;
      },
      withLease: async (_key: string, fn: () => Promise<unknown>) => fn(),
      createConfirmation: async (data: Record<string, unknown>) => {
        const c = { id: "confirmation", ...data, consumedAt: null };
        run.confirmations.push(c);
        return c;
      },
      claimExecution: jest.fn().mockImplementation(async () => {
        run.status = "EXECUTING";
        run.confirmations[0].consumedAt = new Date();
      }),
      notify: jest.fn(),
    };
    const baw = {
      run: jest
        .fn()
        .mockImplementation(
          async (command: string) =>
            ({
              status: { status: "CONNECTED" },
              address: { addresses: [{ binanceChainId: "56", address }] },
              quote: {
                fromCoinSymbol: "BNB",
                fromCoinAmount: "0.1",
                toCoinSymbol: "T",
                toCoinAmount: "1.5",
                slippage: "auto",
              },
              swap: { orderId: "order" },
            })[command],
        ),
    };
    const research = { audit: jest.fn().mockResolvedValue(cleanAudit) };
    return {
      service: new PaidService(
        store as unknown as AgentStore,
        baw as unknown as BawService,
        research as unknown as ResearchProvider,
      ),
      store,
      baw,
      research,
      run,
    };
  }
  const input = {
    amount: "0.1",
    asset: "BNB" as const,
    slippage: "auto",
    confirmationText: "确认买入 0.1 BNB",
  };
  it("quote preparation never swaps; final execution consumes exactly that confirmation", async () => {
    agentEnv.executionEnabled = true;
    const f = fixture();
    await f.service.confirm("brief", input);
    expect(f.run.status).toBe("AWAITING_CONFIRMATION");
    expect(f.baw.run.mock.calls.some((c) => c[0] === "swap")).toBe(false);
    await f.service.execute("run", "confirmation");
    expect(f.store.claimExecution).toHaveBeenCalledWith("run", "confirmation");
    expect(f.run.status).toBe("SUBMITTED");
    await expect(
      f.service.execute("run", "confirmation"),
    ).rejects.toMatchObject({ code: "CONFIRM_REQUIRED" });
    expect(f.baw.run.mock.calls.filter((c) => c[0] === "swap")).toHaveLength(1);
  });
  it("changed audit evidence requires a new review and does not consume funds", async () => {
    agentEnv.executionEnabled = true;
    const f = fixture();
    await f.service.confirm("brief", input);
    f.research.audit.mockResolvedValue({ ...cleanAudit, buyTax: "1" });
    await expect(
      f.service.execute("run", "confirmation"),
    ).rejects.toMatchObject({ code: "AUDIT_CHANGED" });
    expect(f.store.claimExecution).not.toHaveBeenCalled();
    expect(f.baw.run.mock.calls.some((c) => c[0] === "swap")).toBe(false);
  });
});
