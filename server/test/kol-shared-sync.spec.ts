import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KolRepository } from "../src/modules/kol/kol.repository";
import { KolReportRepository } from "../src/modules/kol/kol-report.repository";
import { KolSharedSyncService } from "../src/modules/kol/kol-shared-sync.service";
import { groupReportDays } from "../src/modules/kol/kol-report-view";
import { reportDateFor } from "../src/modules/kol/shared-report-fields";
import {
  parseSharedWatchlist,
  SHARED_WATCHLIST_SCHEMA,
} from "../src/modules/kol/shared-watchlist";
import { planSharedSync } from "../src/modules/kol/shared-sync-plan";

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
      expect.objectContaining({
        handle: "still_daily",
        category: "DAILY",
        note: "keep",
      }),
      expect.objectContaining({
        handle: "custom_one",
        category: "AGENT_WALLET_MINT",
        note: "n",
      }),
    ]);
    const flat = parseSharedWatchlist({
      schema,
      bloggers: [
        { handle: "flat_one", category: "airdrop", notes: "q", projects: [] },
        { xUrl: "http://x.com/insecure", notes: "" },
      ],
    });
    expect(flat.accounts).toEqual([
      expect.objectContaining({
        handle: "flat_one",
        category: "AIRDROP",
        note: "q",
        profileUrl: null,
      }),
    ]);
    expect(flat.skipped).toBe(1);
    expect(
      parseSharedWatchlist({
        schema,
        categories: {
          meme: {
            accounts: [
              {
                xUrl: "https://x.com/from_url",
                notes: "via url",
                projects: [],
              },
            ],
          },
        },
      }).accounts,
    ).toEqual([
      expect.objectContaining({
        handle: "from_url",
        category: "MEME",
        note: "via url",
        profileUrl: "https://x.com/from_url",
      }),
    ]);
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
      {
        handle: "kept_manual",
        category: "DAILY",
        note: "mine",
        source: "MANUAL",
      },
      { handle: "meme_one", category: "DAILY", note: "", source: "MANUAL" },
    ]);
    expect(plan.created).toBe(0);
    expect(plan.updated).toBe(1);
    expect(plan.writes).toEqual([
      {
        handle: "meme_one",
        category: "MEME",
        note: "",
        profileUrl: null,
        projects: [],
        summary: "",
        sharedAt: null,
      },
    ]);
    expect(plan.writes.map((row) => row.handle)).not.toContain("kept_manual");
  });

  it("imports the fixture and leaves a missing file as an error", async () => {
    const record = jest.fn(
      async (snapshot: {
        reportDate: string;
        writes: { handle: string }[];
      }) => ({
        reportId: "report-1",
        ingested: true,
        reportDate: snapshot.reportDate,
      }),
    );
    const listSyncState = jest.fn(async () => [
      { handle: "daily_one", category: "MEME", note: "old", source: "MANUAL" },
      {
        handle: "meme_one",
        category: "MEME",
        note: "",
        source: "SHARED",
        profileUrl: "https://x.com/meme_one",
        projects: [],
        summary: "",
        sharedAt: null,
      },
      {
        handle: "kept_manual",
        category: "DAILY",
        note: "mine",
        source: "MANUAL",
      },
    ]);
    const service = new KolSharedSyncService(
      { listSyncState } as unknown as KolRepository,
      { record } as unknown as KolReportRepository,
    );
    process.env.KOL_SHARED_WATCHLIST_PATH = fixture;
    await expect(
      service.sync(new Date("2026-10-31T16:30:00.000Z")),
    ).resolves.toMatchObject({
      created: 3,
      updated: 1,
      skipped: 5,
      categories: { DAILY: 1, MEME: 1, AIRDROP: 1, AGENT_WALLET_MINT: 2 },
      report: {
        id: "report-1",
        ingested: true,
        reportDate: "2026-11-01",
        entries: 5,
      },
    });
    const writes = record.mock.calls[0][0].writes;
    expect(writes).toEqual([
      expect.objectContaining({
        handle: "daily_one",
        category: "DAILY",
        note: "fixture daily updated",
      }),
      expect.objectContaining({
        handle: "drop_one",
        category: "AIRDROP",
        note: "drop",
        projects: ["quest"],
      }),
      expect.objectContaining({
        handle: "mint_one",
        category: "AGENT_WALLET_MINT",
        note: "mint",
      }),
      expect.objectContaining({
        handle: "mint_two",
        category: "AGENT_WALLET_MINT",
        projects: ["wallet"],
      }),
    ]);
    process.env.KOL_SHARED_WATCHLIST_PATH =
      "/tmp/snk-missing-shared-watchlist.json";
    await expect(service.sync()).rejects.toMatchObject({
      code: "SHARED_WATCHLIST_UNAVAILABLE",
    });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("keeps digest text, status links and the Shanghai report date", () => {
    const parsed = parseSharedWatchlist({
      schema,
      dailySummary: "今日总结",
      categories: {
        meme: {
          label: "MEME",
          highlights: ["要点"],
          actions: ["去核对"],
          accounts: [
            {
              handle: "meme_one",
              notes: "备注",
              summary: "单条要点",
              tweetUrl: "https://x.com/meme_one/status/99",
              projects: ["alpha"],
            },
          ],
        },
      },
    });
    expect(parsed.meta.summary).toBe("今日总结");
    expect(parsed.sections[0]).toMatchObject({
      category: "MEME",
      highlights: ["要点"],
      actions: ["去核对"],
    });
    expect(parsed.accounts[0]).toMatchObject({
      note: "备注",
      summary: "单条要点",
      projects: ["alpha"],
      tweetUrls: ["https://x.com/meme_one/status/99"],
    });
    const bare = {
      explicitDate: null,
      fileUpdatedAt: null,
      summary: "",
      version: null,
      owner: null,
    };
    expect(
      reportDateFor(
        { ...bare, generatedAt: "2026-10-31T16:00:00.000Z" },
        new Date("2020-01-01T00:00:00.000Z"),
      ),
    ).toBe("2026-11-01");
    expect(
      reportDateFor(
        { ...bare, generatedAt: "2026-10-31T15:59:00.000Z" },
        new Date("2020-01-01T00:00:00.000Z"),
      ),
    ).toBe("2026-10-31");
    expect(
      reportDateFor(
        {
          ...bare,
          explicitDate: "2026-10-30",
          generatedAt: "2026-11-02T00:00:00.000Z",
        },
        new Date("2020-01-01T00:00:00.000Z"),
      ),
    ).toBe("2026-10-30");
  });

  it("groups stored digests by report date and keeps the latest first", () => {
    const section = {
      category: "DAILY",
      label: "日常关注",
      summary: "",
      highlights: ["要点"],
      actions: [],
    };
    const entry = {
      handle: "daily_one",
      category: "DAILY",
      note: "备注",
      summary: "",
      profileUrl: null,
      projects: [],
      tweetUrls: [],
    };
    const days = groupReportDays([
      {
        id: "old",
        reportDate: "2026-11-01",
        ingestedAt: "2026-11-01T01:00:00.000Z",
        generatedAt: null,
        summary: "早",
        sections: [section],
        entries: [entry],
      },
      {
        id: "new",
        reportDate: "2026-11-01",
        ingestedAt: "2026-11-01T08:00:00.000Z",
        generatedAt: null,
        summary: "晚",
        sections: [section],
        entries: [{ ...entry, note: "新备注" }],
      },
      {
        id: "prev",
        reportDate: "2026-10-31",
        ingestedAt: "2026-10-31T08:00:00.000Z",
        generatedAt: null,
        summary: "昨天",
        sections: [],
        entries: [],
      },
    ]);
    expect(days.map((day) => day.reportDate)).toEqual([
      "2026-11-01",
      "2026-10-31",
    ]);
    expect(days[0]?.latest.summary).toBe("晚");
    expect(days[0]?.latest.sections[0]?.accounts[0]?.note).toBe("新备注");
    expect(days[0]?.earlierCount).toBe(1);
    expect(days[0]?.earlier[0]?.summary).toBe("早");
    expect(days[1]?.latest.summary).toBe("昨天");
    expect(days[1]?.latest.sections).toEqual([]);
  });

  it("rejects invalid JSON and upserts only shared fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kol-shared-"));
    const service = new KolSharedSyncService(
      { listSyncState: jest.fn() } as unknown as KolRepository,
      { record: jest.fn() } as unknown as KolReportRepository,
    );
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
