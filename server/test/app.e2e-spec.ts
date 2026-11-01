import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AgentLaunchService } from "../src/modules/market/agent-launch.service";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { BawService } from "../src/modules/wallet/baw.service";
import { MarketService } from "../src/modules/market/market.service";
import { setupApp } from "../src/common/setup-app";
describe("Local API contract", () => {
  let app: INestApplication;
  const id = "8277dd94-6876-4044-a962-e4ac9592a575";
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([1]),
    kol: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ id, handle: "example", note: "" }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const baw = { run: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AgentLaunchService)
      .useValue({
        list: jest
          .fn()
          .mockResolvedValue({
            chain: "bsc",
            scope: "AGENT_LAUNCHPADS",
            coverage: "BOUNDED_SAMPLE",
            fetchedAt: "2026-10-28T00:00:00Z",
            tokens: [],
            sources: [],
          }),
      })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(BawService)
      .useValue(baw)
      .overrideProvider(MarketService)
      .useValue({
        search: jest
          .fn()
          .mockResolvedValue({ source: "DEX Screener", pairs: [] }),
      })
      .compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => baw.run.mockReset());
  const call = () => request(app.getHttpServer());
  it("health includes a database check and envelope", async () => {
    const response = await call().get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body.data.database).toBe("connected");
    expect(response.body.code).toBe(0);
  });
  it("rejects cross-origin login and remote host", async () => {
    expect(
      (
        await call()
          .post("/api/v1/wallet/signin")
          .set("Origin", "https://evil.example")
      ).status,
    ).toBe(403);
    expect(
      (await call().get("/api/v1/health").set("Host", "evil.example")).status,
    ).toBe(403);
    expect(baw.run).not.toHaveBeenCalled();
  });
  it("reports a delegated wallet and does not call the CLI", async () => {
    const response = await call().get("/api/v1/wallet/status");
    expect(response.body.data).toEqual({ status: "DELEGATED", login: null });
    expect(baw.run).not.toHaveBeenCalled();
  });
  it("refuses sign-in and live balances", async () => {
    const signin = await call().post("/api/v1/wallet/signin").send({});
    const overview = await call().get("/api/v1/wallet/overview");
    expect(signin.status).toBe(409);
    expect(signin.body.code).toBe("WALLET_DELEGATED");
    expect(overview.status).toBe(409);
    expect(overview.body.code).toBe("WALLET_DELEGATED");
    expect(baw.run).not.toHaveBeenCalled();
  });
  it("exposes Agent launch contract and rejects non-BNB or unexpected query inputs", async () => {
    const response = await call().get(
      "/api/v1/market/agent-launches?chain=bsc",
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      chain: "bsc",
      scope: "AGENT_LAUNCHPADS",
      tokens: [],
      sources: [],
    });
    expect(
      (await call().get("/api/v1/market/agent-launches?chain=solana")).status,
    ).toBe(400);
    expect(
      (
        await call().get(
          "/api/v1/market/agent-launches?url=https://example.com",
        )
      ).status,
    ).toBe(400);
  });
  it("returns market and rejects invalid network", async () => {
    expect((await call().get("/api/v1/market/pairs")).body.data.pairs).toEqual(
      [],
    );
    expect((await call().get("/api/v1/market/pairs?chain=bad")).status).toBe(
      400,
    );
    expect((await call().get("/api/v1/market/pairs?q=")).status).toBe(400);
  });
  it("lists, creates and deletes watchlist accounts", async () => {
    expect((await call().get("/api/v1/kols")).body.data.accounts).toEqual([]);
    expect(
      (await call().post("/api/v1/kols").send({ handle: "example" })).body.data
        .id,
    ).toBe(id);
    expect((await call().delete(`/api/v1/kols/${id}`)).body.data.removed).toBe(
      true,
    );
  });
  it("validates handles, unexpected fields, notes and UUIDs", async () => {
    for (const body of [
      { handle: "a; rm -rf" },
      { handle: "example", admin: true },
      { handle: "example", note: "a".repeat(501) },
    ])
      expect((await call().post("/api/v1/kols").send(body)).status).toBe(400);
    expect((await call().delete("/api/v1/kols/invalid")).status).toBe(400);
  });
  it("validates KOL category and edit fields", async () => {
    expect(
      (
        await call()
          .post("/api/v1/kols")
          .send({ handle: "example", category: "BAD" })
      ).status,
    ).toBe(400);
    expect(
      (
        await call()
          .patch(`/api/v1/kols/${id}`)
          .send({ handle: "example", category: "BAD" })
      ).status,
    ).toBe(400);
    expect(
      (
        await call()
          .patch(`/api/v1/kols/${id}`)
          .send({ handle: "bad handle", category: "MEME" })
      ).status,
    ).toBe(400);
    expect(
      (
        await call()
          .patch("/api/v1/kols/bad")
          .send({ handle: "example", category: "MEME" })
      ).status,
    ).toBe(400);
  });
});
