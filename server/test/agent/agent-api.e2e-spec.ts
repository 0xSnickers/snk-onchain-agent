import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/prisma/prisma.service";
import { AgentStore } from "../../src/modules/agent-runs/agent.store";
import { WalletIdentityService } from "../../src/modules/wallet/wallet-identity.service";
import { ActivityRepository } from "../../src/modules/wallet-activity/activity.repository";
import { BawService } from "../../src/modules/wallet/baw.service";
import { setupApp } from "../../src/common/setup-app";
const id = "8277dd94-6876-4044-a962-e4ac9592a575",
  address = "0x" + "1".repeat(40),
  scope = "EVM:" + address;
describe("Wallet logs and execution API", () => {
  let app: INestApplication;
  const store = {
    runs: jest.fn().mockResolvedValue([]),
    run: jest.fn(),
    candidates: jest.fn().mockResolvedValue([]),
    addCandidate: jest.fn(),
    notifications: jest.fn().mockResolvedValue([]),
  };
  const baw = { run: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: async () => [1] })
      .overrideProvider(AgentStore)
      .useValue(store)
      .overrideProvider(BawService)
      .useValue(baw)
      .overrideProvider(WalletIdentityService)
      .useValue({ current: async () => ({ scope, address, addresses: [] }) })
      .overrideProvider(ActivityRepository)
      .useValue({ list: async () => ({ items: [], nextCursor: null }) })
      .compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    baw.run.mockReset();
    store.run.mockReset();
  });
  const call = () => request(app.getHttpServer());
  it("returns current wallet partition and paginated actual history source", async () => {
    const r = await call().get("/api/v1/wallet/activity?type=MINT");
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      walletScope: scope,
      source: "BINANCE_AGENTIC_WALLET",
      items: [],
    });
  });
  it("scopes local run queries to the connected wallet", async () => {
    const r = await call().get("/api/v1/agent/runs");
    expect(r.body.data.walletScope).toBe(scope);
    expect(store.runs).toHaveBeenCalledWith(undefined, 20, scope);
  });
  it("rejects another wallet run and never exposes private execution context", async () => {
    store.run.mockResolvedValueOnce({ walletScope: "another-wallet" });
    expect((await call().get(`/api/v1/agent/runs/${id}`)).status).toBe(404);
    store.run.mockResolvedValueOnce({
      id,
      walletScope: scope,
      confirmations: [],
      actions: [],
      contextJson: { private: "hidden" },
    });
    const r = await call().get(`/api/v1/agent/runs/${id}`);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain("hidden");
  });
  it("a research run cannot be executed without a confirmation", async () => {
    store.run.mockResolvedValue({
      id,
      kind: "RESEARCH",
      status: "SUCCEEDED",
      walletScope: scope,
    });
    const r = await call().post(`/api/v1/agent/runs/${id}/execute`).send({});
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("WALLET_DELEGATED");
    expect(baw.run).not.toHaveBeenCalled();
  });
  it("rejects malformed history filters, cursors and candidate addresses", async () => {
    expect(
      (await call().get("/api/v1/wallet/activity?type=INVALID")).status,
    ).toBe(400);
    expect((await call().get("/api/v1/agent/runs?cursor=no")).status).toBe(400);
    expect(
      (
        await call()
          .post("/api/v1/mint/candidates")
          .send({ contractAddress: "0x0" })
      ).status,
    ).toBe(400);
  });
  it("cannot bypass the confirmation boundary with arbitrary CLI options", async () => {
    const r = await call()
      .post(`/api/v1/agent/runs/${id}/execute`)
      .send({ command: "wallet send", value: "1000" });
    expect(r.status).toBe(400);
    expect(baw.run).not.toHaveBeenCalled();
  });
});
