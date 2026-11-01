import { LaunchHttpProvider } from "../src/modules/market/launch-http.provider";
import { FlapAgentProvider } from "../src/modules/market/flap-agent.provider";
import { AgentLaunchService } from "../src/modules/market/agent-launch.service";
import { NetworkService } from "../src/common/network.service";
import { AppError } from "../src/common/http";
import { Interface, ZeroAddress } from "ethers";
const a = "0x" + "1".repeat(40);
const version = "openfour.meme.AgentIdExclusive";
const network = { json: jest.fn() };
const provider = () =>
  new LaunchHttpProvider(network as unknown as NetworkService);
beforeEach(() => network.json.mockReset());
it("sends both exclusive filters and independently rejects other chains/templates/protocols", async () => {
  const good = {
    contractAddress: a,
    chainId: "56",
    protocol: 2004,
    tokenVersion: version,
    migrateStatus: 0,
    price: "0",
    progress: null,
  };
  network.json.mockResolvedValue({
    code: "000000",
    success: true,
    data: [
      good,
      { ...good, protocol: 2001 },
      { ...good, tokenVersion: "other" },
      { ...good, chainId: "1" },
      { ...good, migrateStatus: 1 },
    ],
  });
  const result = await provider().four("NEW");
  expect(network.json.mock.calls[0][1]).toMatchObject({
    protocol: [2004],
    tokenVersionFilter: { "2004": [version] },
    rankType: 10,
  });
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    address: a,
    priceUsd: "0",
    progress: null,
    evidence: "AGENT_ID_TEMPLATE",
    stage: "NEW",
  });
});
it("distinguishes valid empty lists from failed/malformed envelopes", async () => {
  network.json.mockResolvedValue({ code: "000000", success: true, data: [] });
  expect(await provider().four("MIGRATED")).toEqual([]);
  network.json.mockResolvedValue({ code: "000000", success: false, data: [] });
  await expect(provider().four("NEW")).rejects.toMatchObject({
    code: "LAUNCH_UPSTREAM_ERROR",
  });
  network.json.mockResolvedValue({});
  await expect(provider().gang(false)).rejects.toMatchObject({
    code: "LAUNCH_INVALID_RESPONSE",
  });
});
it("maps Gang lifecycle, preserves unknown values and never multiplies missing prices", async () => {
  network.json.mockResolvedValue({
    items: [
      {
        address: a,
        graduated: false,
        progressPct: 88,
        priceBnb: 1,
        bnbUsd: null,
      },
    ],
  });
  expect((await provider().gang(false))[0]).toMatchObject({
    stage: "FINALIZING",
    priceUsd: null,
    holders: null,
  });
  network.json.mockResolvedValue({
    items: [
      {
        address: a,
        graduated: true,
        priceUsd: "0.00000003",
        logoUrl: "javascript:alert(1)",
      },
    ],
  });
  expect((await provider().gang(true))[0]).toMatchObject({
    stage: "MIGRATED",
    priceUsd: "0.00000003",
    imageUrl: null,
  });
});
it("reports partial source failures, caches/coalesces, deduplicates and prefers later Four stages", async () => {
  network.json.mockImplementation(
    async (url: string, body?: { rankType: number }) => {
      if (body)
        return {
          success: true,
          code: "000000",
          data: [
            {
              contractAddress: a,
              chainId: "56",
              protocol: 2004,
              tokenVersion: version,
              migrateStatus: body.rankType === 30 ? 1 : 0,
            },
          ],
        };
      if (url.includes("stocks"))
        throw new AppError("UPSTREAM_UNAVAILABLE", "secret-url");
      return { items: [] };
    },
  );
  const flap = { list: jest.fn(async () => []) };
  const service = new AgentLaunchService(
    provider(),
    flap as unknown as FlapAgentProvider,
  );
  const [first, second] = await Promise.all([service.list(), service.list()]);
  expect(first).toEqual(second);
  expect(first.tokens).toHaveLength(1);
  expect(first.tokens[0].stage).toBe("MIGRATED");
  expect(first.sources.find((s) => s.source === "GANG_V2")).toMatchObject({
    status: "ERROR",
    error: { code: "UPSTREAM_UNAVAILABLE" },
  });
  expect(JSON.stringify(first)).not.toContain("secret-url");
  await service.list();
  expect(flap.list).toHaveBeenCalledTimes(1);
});
it("returns an explicit error when all sources fail", async () => {
  network.json.mockRejectedValue(new Error("secret"));
  const flap = { list: jest.fn().mockRejectedValue(new Error("secret")) };
  await expect(
    new AgentLaunchService(
      provider(),
      flap as unknown as FlapAgentProvider,
    ).list(),
  ).rejects.toMatchObject({ code: "LAUNCH_UNAVAILABLE" });
});
it("decodes pinned Flap reader cards and labels a predicted token without fabricated metrics", async () => {
  const abi = new Interface([
    "function marketPage(uint256,uint256) view returns (address[] marketAddresses,uint256 nextCursor,uint256 total)",
    "function marketCards(address[]) view returns (tuple(address market,address quoteToken,string name,string symbol,string meta,address predictedToken,address token,address pair,uint8 phase,uint256 poolRaw,uint256 capRaw,uint256 progressBps,uint256 buyCount,uint256 sellCount,uint256 curveH,uint256 curveK)[] cards)",
  ]);
  network.json.mockImplementation(async (_url, body) => {
    if (body.method === "eth_chainId") return { result: "0x38" };
    if (body.method === "eth_blockNumber") return { result: "0x123" };
    expect(body.params[1]).toBe("0x123");
    const tx = abi.parseTransaction({ data: body.params[0].data })!;
    return {
      result:
        tx.name === "marketPage"
          ? abi.encodeFunctionResult("marketPage", [[a], 1, 1])
          : abi.encodeFunctionResult("marketCards", [
              [
                [
                  a,
                  ZeroAddress,
                  "Agent",
                  "AG",
                  "",
                  a,
                  ZeroAddress,
                  ZeroAddress,
                  1,
                  0,
                  0,
                  8200,
                  0,
                  0,
                  0,
                  0,
                ],
              ],
            ]),
    };
  });
  const result = await new FlapAgentProvider(
    network as unknown as NetworkService,
  ).list();
  expect(result[0]).toMatchObject({
    address: a,
    tokenDeployed: false,
    stage: "FINALIZING",
    progress: 82,
    priceUsd: null,
    marketAddress: a,
  });
  network.json.mockResolvedValue({ result: "0x1" });
  await expect(
    new FlapAgentProvider(network as unknown as NetworkService).list(),
  ).rejects.toMatchObject({ code: "LAUNCH_CHAIN_MISMATCH" });
});
