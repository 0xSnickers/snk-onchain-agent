import { XapiProvider } from "../src/modules/kol/xapi.provider";
import { KolSyncService } from "../src/modules/kol/kol-sync.service";
import { KolRepository } from "../src/modules/kol/kol.repository";
import { NetworkService } from "../src/common/network.service";
import { AppError } from "../src/common/http";
const before = process.env.XAPI_KEY;
afterEach(() => {
  if (before === undefined) delete process.env.XAPI_KEY;
  else process.env.XAPI_KEY = before;
});
it("sends only whitelisted read actions and normalizes tweets from the requested author", async () => {
  process.env.XAPI_KEY = "fixture-only-key";
  const json = jest
    .fn()
    .mockResolvedValueOnce({ data: { rest_id: "123" } })
    .mockResolvedValueOnce({
      data: {
        tweets: [
          {
            id: "555",
            full_text: "Test fixture",
            created_at: "2026-10-28T00:00:00Z",
            author: { id: "123", screen_name: "test" },
            favorite_count: 5,
          },
          {
            id: "556",
            full_text: "Another author",
            author: { id: "456", screen_name: "other" },
          },
        ],
        cursors: { bottom: "opaque-cursor" },
      },
    });
  const p = new XapiProvider({ json } as unknown as NetworkService);
  expect(await p.user("test")).toBe("123");
  const r = await p.tweets("123");
  expect(r.posts).toHaveLength(1);
  expect(r.nextCursor).toBe("opaque-cursor");
  expect(json.mock.calls[0][0]).toBe(
    "https://action.xapi.to/v1/actions/execute",
  );
  expect(json.mock.calls[0][1]).toEqual({
    action_id: "twitter.user_by_screen_name",
    input: { screen_name: "test" },
  });
});
it("reports missing configuration and malformed upstream rather than empty success", async () => {
  delete process.env.XAPI_KEY;
  const json = jest.fn();
  const p = new XapiProvider({ json } as unknown as NetworkService);
  await expect(p.user("test")).rejects.toMatchObject({
    code: "XAPI_NOT_CONFIGURED",
  });
  expect(json).not.toHaveBeenCalled();
  process.env.XAPI_KEY = "fixture-only-key";
  json.mockResolvedValue({ data: {} });
  await expect(p.tweets("123")).rejects.toMatchObject({
    code: "XAPI_INVALID_RESPONSE",
  });
});
it("persists success, follows saved cursor and prevents repeated paid fetches within cooldown", async () => {
  process.env.XAPI_KEY = "fixture-only-key";
  const repo = {
    find: jest.fn(async () => ({
      id: "fixture",
      handle: "test",
      xUserId: "123",
      displayName: "Test",
      avatarUrl: "https://pbs.twimg.com/fixture.jpg",
      nextCursor: "cursor",
    })),
    savePosts: jest.fn(),
    syncFailed: jest.fn(),
  };
  const xapi = {
    user: jest.fn(),
    tweets: jest.fn(async () => ({ posts: [], nextCursor: null })),
  };
  const s = new KolSyncService(
    repo as unknown as KolRepository,
    xapi as unknown as XapiProvider,
  );
  await s.sync("fixture", true);
  expect(xapi.tweets).toHaveBeenCalledWith("123", "cursor");
  expect(repo.savePosts).toHaveBeenCalledWith(
    "fixture",
    "123",
    [],
    null,
    undefined,
    "test",
    undefined,
  );
  await expect(s.sync("fixture")).rejects.toMatchObject({
    code: "KOL_SYNC_COOLDOWN",
  });
  expect(xapi.tweets).toHaveBeenCalledTimes(1);
});
it("keeps stored posts and records upstream failures", async () => {
  process.env.XAPI_KEY = "fixture-only-key";
  const repo = {
    find: jest.fn(async () => ({
      handle: "test",
      xUserId: "123",
      displayName: "Test",
      avatarUrl: "https://pbs.twimg.com/fixture.jpg",
    })),
    savePosts: jest.fn(),
    syncFailed: jest.fn(),
  };
  const xapi = {
    tweets: jest.fn(async () => {
      throw new AppError("UPSTREAM_UNAVAILABLE", "Upstream request failed");
    }),
  };
  const s = new KolSyncService(
    repo as unknown as KolRepository,
    xapi as unknown as XapiProvider,
  );
  await expect(s.sync("fixture")).rejects.toMatchObject({
    code: "UPSTREAM_UNAVAILABLE",
  });
  expect(repo.savePosts).not.toHaveBeenCalled();
  expect(repo.syncFailed).toHaveBeenCalledWith(
    "fixture",
    "Upstream request failed",
    "test",
  );
});

it("uses the official XAPI-Key header and handles HTTP-200 action errors explicitly", async () => {
  process.env.XAPI_KEY = "fixture-only-key";
  const json = jest.fn().mockResolvedValue({
    success: false,
    error: { code: "PLATFORM_HTTP_401", message: "untrusted error" },
  });
  const provider = new XapiProvider({ json } as unknown as NetworkService);
  await expect(provider.user("test")).rejects.toMatchObject({
    code: "XAPI_AUTH_FAILED",
  });
  expect(json.mock.calls[0][2]).toEqual({ "XAPI-Key": "fixture-only-key" });
  json.mockResolvedValue({
    success: false,
    error: { code: "PLATFORM_HTTP_402" },
  });
  await expect(provider.user("test")).rejects.toMatchObject({
    code: "XAPI_QUOTA_EXCEEDED",
  });
  json.mockResolvedValue({
    success: false,
    error: { code: "PLATFORM_HTTP_429" },
  });
  await expect(provider.user("test")).rejects.toMatchObject({
    code: "XAPI_RATE_LIMITED",
  });
});

it("fills a missing nickname from the real profile and binds it to the existing user ID", async () => {
  process.env.XAPI_KEY = "fixture-only-key";
  const repo = {
    find: jest.fn(async () => ({
      handle: "test",
      xUserId: "123",
      displayName: null,
    })),
    savePosts: jest.fn(),
    syncFailed: jest.fn(),
  };
  const xapi = {
    profile: jest.fn(async () => ({ id: "123", displayName: "测试昵称" })),
    tweets: jest.fn(async () => ({ posts: [], nextCursor: null })),
  };
  const service = new KolSyncService(
    repo as unknown as KolRepository,
    xapi as unknown as XapiProvider,
  );
  await service.sync("fixture");
  expect(repo.savePosts).toHaveBeenCalledWith(
    "fixture",
    "123",
    [],
    null,
    "测试昵称",
    "test",
    undefined,
  );
});
it("rejects a reassigned handle instead of replacing the monitored identity", async () => {
  process.env.XAPI_KEY = "fixture-only-key";
  const repo = {
    find: jest.fn(async () => ({
      handle: "test",
      xUserId: "123",
      displayName: null,
    })),
    savePosts: jest.fn(),
    syncFailed: jest.fn(),
  };
  const xapi = {
    profile: jest.fn(async () => ({
      id: "456",
      displayName: "Another account",
    })),
    tweets: jest.fn(),
  };
  const service = new KolSyncService(
    repo as unknown as KolRepository,
    xapi as unknown as XapiProvider,
  );
  await expect(service.sync("fixture")).rejects.toMatchObject({
    code: "KOL_IDENTITY_CHANGED",
  });
  expect(xapi.tweets).not.toHaveBeenCalled();
  expect(repo.savePosts).not.toHaveBeenCalled();
});

it("skips live fetch without recording a failure when XAPI_KEY is empty", async () => {
  process.env.XAPI_KEY = " ";
  const repo = {
    find: jest.fn(async () => ({ id: "fixture", handle: "test" })),
    syncFailed: jest.fn(),
    savePosts: jest.fn(),
  };
  const xapi = { profile: jest.fn(), tweets: jest.fn() };
  const service = new KolSyncService(
    repo as unknown as KolRepository,
    xapi as unknown as XapiProvider,
  );
  await expect(service.sync("fixture")).resolves.toMatchObject({
    imported: 0,
    skipped: true,
    reason: "XAPI_OPTIONAL",
  });
  expect(xapi.tweets).not.toHaveBeenCalled();
  expect(repo.syncFailed).not.toHaveBeenCalled();
  expect(repo.savePosts).not.toHaveBeenCalled();
});
