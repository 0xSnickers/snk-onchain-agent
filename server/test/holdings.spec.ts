import { HoldingsService } from "../src/modules/wallet/holdings.service";
import { NetworkService } from "../src/common/network.service";
describe("on-chain holdings", () => {
  it("prices BNB and keeps a one-unit NFT without a dollar value", async () => {
    const network = {
      json: jest.fn(async (url: string, body?: { method?: string; params?: [{ data?: string }] }) => {
        if (String(url).includes("dexscreener"))
          return { pairs: [{ chainId: "bsc", priceUsd: "600" }] };
        if (body?.method === "eth_chainId") return { result: "0x38" };
        if (body?.method === "eth_getBalance") return { result: "0xde0b6b3a7640000" };
        const data = body?.params?.[0]?.data || "";
        if (data.startsWith("0x70a08231")) return { result: "0x1" };
        return { result: "0x" };
      }),
    };
    const result = await new HoldingsService(network as unknown as NetworkService).collect(
      "0x" + "ab".repeat(20),
      "EVM:" + "ab".repeat(20),
      [{ address: "0x" + "11".repeat(20), name: "BOO" }],
    );
    expect(result.assets.map((asset) => asset.symbol)).toEqual(["BNB", "BOO"]);
    expect(result.assets[0]).toMatchObject({ balance: "1", valueUsd: "600" });
    expect(result.assets[1]).toMatchObject({ kind: "NFT", balance: "1", valueUsd: null });
  });
});
