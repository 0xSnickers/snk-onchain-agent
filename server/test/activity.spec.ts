import {
  projectTransactions,
  units,
} from "../src/modules/wallet-activity/activity.projection";
import { ActivityService } from "../src/modules/wallet-activity/activity.service";
import { WalletIdentityService } from "../src/modules/wallet/wallet-identity.service";
import { ActivityRepository } from "../src/modules/wallet-activity/activity.repository";
const address = "0x" + "1".repeat(40),
  hash = "0x" + "a".repeat(64);
const identity = {
  scope: "EVM:" + address,
  address,
  addresses: [{ binanceChainId: "56", chainName: "BSC", address }],
};
describe("Wallet-owned activity import", () => {
  it("formats exact raw units without Number precision loss", () => {
    expect(units("1234567890123456789123456789", 18)).toBe(
      "1234567890.123456789123456789",
    );
    expect(units("1", 18)).toBe("0.000000000000000001");
    expect(units("0", 18)).toBe("0");
    expect(units("1000", 0)).toBe("1000");
  });
  it("projects actual wallet history and does not infer a Mint from a generic call", () => {
    const rows = projectTransactions(
      [
        {
          txType: "contract_call",
          txTime: "2026-10-27T10:00:00Z",
          txHashList: [
            {
              binanceChainId: "56",
              txHash: hash,
              status: "confirmed",
              sessionToken: "secret",
              instructions: {
                receive: [
                  {
                    amount: "1",
                    tokenInfo: {
                      symbol: "T",
                      contractAddress: address,
                      decimals: 18,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
      identity,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      walletScope: identity.scope,
      type: "CONTRACT",
      txHash: hash,
    });
    expect(rows[0].movements[0].amount).toBe("0.000000000000000001");
    expect(JSON.stringify(rows)).not.toContain("secret");
  });
  it("maps explicit provider Mint and swap records and skips foreign chains", () => {
    const rows = projectTransactions(
      [
        { txType: "mint", txHash: hash, binanceChainId: "56" },
        { txType: "swap", txHash: hash, binanceChainId: "56" },
        { txType: "mint", txHash: hash, binanceChainId: "1" },
      ],
      identity,
    );
    expect(rows.map((r) => r.type)).toEqual(["MINT", "TRADE"]);
  });
  it("partitions DB reads using the current wallet", async () => {
    const repository = {
      list: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };
    const service = new ActivityService(
      { current: async () => identity } as WalletIdentityService,
      repository as unknown as ActivityRepository,
    );
    const data = await service.list(undefined, "MINT");
    expect(repository.list).toHaveBeenCalledWith(
      identity.scope,
      undefined,
      "MINT",
    );
    expect(data.walletScope).toBe(identity.scope);
  });
  it("does not pull live wallet history", async () => {
    const repository = { save: jest.fn() };
    const service = new ActivityService(
      { current: async () => identity } as WalletIdentityService,
      repository as unknown as ActivityRepository,
    );
    expect(() => service.sync()).toThrow(
      expect.objectContaining({ code: "WALLET_DELEGATED" }),
    );
    expect(repository.save).not.toHaveBeenCalled();
  });
});
