import { PaidService } from "../src/modules/execution/paid.service";
import { AgentStore } from "../src/modules/agent-runs/agent.store";
import { BawService } from "../src/modules/wallet/baw.service";
import { ResearchProvider } from "../src/modules/research/research.provider";
describe("Paid purchase gates", () => {
  const baw = { run: jest.fn() };
  beforeEach(() => baw.run.mockReset());
  it("rejects ambiguous user confirmation before querying the wallet", async () => {
    const service = new PaidService(
      {} as AgentStore,
      baw as unknown as BawService,
      {} as ResearchProvider,
    );
    await expect(
      service.confirm("brief", {
        amount: "1",
        asset: "BNB",
        slippage: "auto",
        confirmationText: "buy a little",
      }),
    ).rejects.toMatchObject({ code: "CONFIRM_REQUIRED" });
    expect(baw.run).not.toHaveBeenCalled();
  });
  it("unavailable audit cannot turn into a buy", async () => {
    const store = {
      brief: async () => ({
        auditAvailable: false,
        dynamicAvailable: true,
        createdAt: new Date(),
      }),
    };
    const service = new PaidService(
      store as unknown as AgentStore,
      baw as unknown as BawService,
      {} as ResearchProvider,
    );
    await expect(
      service.confirm("brief", {
        amount: "1",
        asset: "BNB",
        slippage: "auto",
        confirmationText: "确认买入 1 BNB",
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_REQUIRED" });
    expect(baw.run).not.toHaveBeenCalled();
  });
  it("execute without a stored confirmation always rejects", async () => {
    const service = new PaidService(
      {} as AgentStore,
      baw as unknown as BawService,
      {} as ResearchProvider,
    );
    await expect(service.execute("run", "")).rejects.toMatchObject({
      code: "CONFIRM_REQUIRED",
    });
    expect(baw.run).not.toHaveBeenCalled();
  });
});
