import { parseHoldersSnapshot } from "../src/modules/wallet/holders-snapshot";

it("reads holder counts and keeps an unknown series as a note", () => {
  const snapshot = parseHoldersSnapshot(
    JSON.stringify({
      queriedAtISO: "2026-10-28T09:42:41.406Z",
      results: [
        {
          contract: "0x" + "ab".repeat(20),
          holders: 1743,
          confidence: "ok",
          note: null,
        },
        {
          contract: "0x" + "cd".repeat(20),
          holders: null,
          confidence: "unknown",
          note: "窗口内无相关 Transfer，无法统计",
        },
        { contract: "not-an-address", holders: 1, confidence: "high" },
      ],
    }),
  );
  expect(snapshot?.fetchedAt).toBe("2026-10-28T09:42:41.406Z");
  expect(snapshot?.byAddress.get("0x" + "ab".repeat(20))).toMatchObject({
    holders: 1743,
    holdersConfidence: "ok",
  });
  expect(snapshot?.byAddress.get("0x" + "cd".repeat(20))?.note).toContain("无法统计");
  expect(snapshot?.byAddress.size).toBe(2);
});
