import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KolRepository } from "../src/modules/kol/kol.repository";
import { KolSharedSyncService } from "../src/modules/kol/kol-shared-sync.service";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  parseSharedWatchlist,
  planSharedSync,
  SHARED_WATCHLIST_SCHEMA,
} from "../src/modules/kol/shared-watchlist";

const fixture = join(__dirname, "fixtures/x-mint-bloggers.json");
const schema = SHARED_WATCHLIST_SCHEMA;

describe("shared KOL watchlist", () => {
  const previous = process.env.KOL_SHARED_WATCHLIST_PATH;
  afterEach(() => {
    if (previous === undefined) delete process.env.KOL_SHARED_WATCHLIST_PATH;
    else process.env.KOL_SHARED_WATCHLIST_PATH = previous;
  });

  it("maps snkKolHint categories and skips invalid rows", () => {
    const parsed = parseSharedWatchlist({
      schema,
      snkKolHint: {
        categoryMap: { daily: "NOT_REAL", custom_bucket: "AGENT_WALLET_MINT" },
      },
      daily: [{ handle: "still_daily", notes: "  keep  ", projects: [] }],
      custom_bucket: [{ handle: "custom_one", notes: "n", projects: ["p"] }],
    });
    expect(parsed.accounts).toEqual([
      { handle: "still_daily", category: "DAILY", note: "keep" },
      { handle: "custom_one", category: "AGENT_WALLET_MINT", note: "n" },
    ]);
    const flat = parseSharedWatchlist({
      schema,
      bloggers: [
        { handle: "flat_one", category: "airdrop", notes: "q", projects: [] },
        { xUrl: "http://x.com/insecure", notes: "" },
      ],
    });
    expect(flat.accounts).toEqual([
      { handle: "flat_one", category: "AIRDROP", note: "q" },
    ]);
    expect(flat.skipped).toBe(1);
    expect(
      parseSharedWatchlist({
        schema,
        categories: {
          meme: {
            accounts: [{ xUrl: "https://x.com/from_url", notes: "via url", projects: [] }],
          },
        },
      }).accounts,
    ).toEqual([{ handle: "from_url", category: "MEME", note: "via url" }]);
    expect(() => parseSharedWatchlist({ schema: "other" })).toThrow(
      expect.objectContaining({ code: "SHARED_WATCHLIST_INVALID" }),
    );
  });

  it("plans creates and updates without removing manual extras", () => {
    const parsed = parseSharedWatchlist({
      schema,
      categories: {
        meme: {
          accounts: [{ handle: "meme_one", notes: "", projects: [] }],
        },
      },
    });
    const plan = planSharedSync(parsed, [
      { handle: "kept_manual", category: "DAILY", note: "mine", source: "MANUAL" },
      { handle: "meme_one", category: "DAILY", note: "", source: "MANUAL" },
    ]);
    expect(plan.created).toBe(0);
    expect(plan.updated).toBe(1);
    expect(plan.writes).toEqual([
      { handle: "meme_one", category: "MEME", note: "" },
    ]);
    expect(plan.writes.map((row) => row.handle)).not.toContain("kept_manual");
  });

  it("imports the fixture and leaves a missing file as an error", async () => {
    const applyShared = jest.fn<
      Promise<void>,
      [{ handle: string; category: string; note: string }[]]
    >().mockResolvedValue(undefined);
    const listSyncState = jest.fn(async () => [
      { handle: "daily_one", category: "MEME", note: "old", source: "MANUAL" },
      { handle: "meme_one", category: "MEME", note: "", source: "SHARED" },
      { handle: "kept_manual", category: "DAILY", note: "mine", source: "MANUAL" },
    ]);
    const service = new KolSharedSyncService({
      listSyncState,
      applyShared,
    } as unknown as KolRepository);
    process.env.KOL_SHARED_WATCHLIST_PATH = fixture;
    await expect(service.sync()).resolves.toEqual({
      created: 3,
      updated: 1,
      skipped: 5,
      categories: { DAILY: 1, MEME: 1, AIRDROP: 1, AGENT_WALLET_MINT: 2 },
    });
    const writes = applyShared.mock.calls[0][0];
    expect(writes).toEqual([
      { handle: "daily_one", category: "DAILY", note: "fixture daily updated" },
      { handle: "drop_one", category: "AIRDROP", note: "drop" },
      { handle: "mint_one", category: "AGENT_WALLET_MINT", note: "mint" },
      { handle: "mint_two", category: "AGENT_WALLET_MINT", note: "" },
    ]);
    process.env.KOL_SHARED_WATCHLIST_PATH =
      "/tmp/snk-missing-shared-watchlist.json";
    await expect(service.sync()).rejects.toMatchObject({
      code: "SHARED_WATCHLIST_UNAVAILABLE",
    });
    expect(applyShared).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid JSON and upserts only shared fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kol-shared-"));
    const upsert = jest.fn(async () => ({}));
    const prisma = {
      kol: { upsert },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const repository = new KolRepository(prisma as unknown as PrismaService);
    await repository.applyShared([]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await repository.applyShared([
      { handle: "mint_one", category: "AGENT_WALLET_MINT", note: "mint" },
    ]);
    expect(upsert).toHaveBeenCalledWith({
      where: { handle: "mint_one" },
      create: {
        handle: "mint_one",
        category: "AGENT_WALLET_MINT",
        note: "mint",
        source: "SHARED",
      },
      update: {
        category: "AGENT_WALLET_MINT",
        note: "mint",
        source: "SHARED",
      },
    });
    const service = new KolSharedSyncService(repository);
    process.env.KOL_SHARED_WATCHLIST_PATH = join(dir, "bad.json");
    try {
      await writeFile(process.env.KOL_SHARED_WATCHLIST_PATH, "{");
      await expect(service.sync()).rejects.toMatchObject({
        code: "SHARED_WATCHLIST_INVALID",
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
