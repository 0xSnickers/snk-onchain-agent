import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FairMintProvider } from "../src/modules/delegation/detection.provider";
import { RpcService } from "../src/modules/execution/rpc.service";
import * as holders from "../src/modules/wallet/holders-snapshot";
const address = "0x" + "1".repeat(40);
describe("External fair mint provider", () => {
  let dir: string;
  const previous = process.env.EXTERNAL_FAIR_MINT_FILE;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "fair-mint-test-"));
    process.env.EXTERNAL_FAIR_MINT_FILE = join(dir, "registry.json");
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    if (previous === undefined) delete process.env.EXTERNAL_FAIR_MINT_FILE;
    else process.env.EXTERNAL_FAIR_MINT_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  });
  it("discovers a configured non-launchpad contract without wallet calls", async () => {
    await writeFile(
      process.env.EXTERNAL_FAIR_MINT_FILE!,
      JSON.stringify({
        schema: "snk-onchain-agent/fair-mints@1",
        candidates: [
          {
            contractAddress: address,
            class: "FREE_MINT",
            inputData: "0x12345678",
          },
        ],
      }),
    );
    const rpc = { call: jest.fn() };
    const provider = new FairMintProvider(rpc as unknown as RpcService);
    expect(await provider.discover()).toEqual([
      expect.objectContaining({
        contractAddress: address,
        chainId: "56",
        autoExecute: false,
      }),
    ]);
    expect(rpc.call).not.toHaveBeenCalled();
  });
  it("reports missing or invalid registry separately from a successful empty registry", async () => {
    const provider = new FairMintProvider({} as RpcService);
    await expect(provider.discover()).rejects.toMatchObject({
      code: "FAIR_MINT_INVALID",
    });
    await writeFile(
      process.env.EXTERNAL_FAIR_MINT_FILE!,
      JSON.stringify({
        schema: "snk-onchain-agent/fair-mints@1",
        candidates: [],
      }),
    );
    expect(await provider.discover()).toEqual([]);
    delete process.env.EXTERNAL_FAIR_MINT_FILE;
    await expect(provider.discover()).rejects.toMatchObject({
      code: "FAIR_MINT_NOT_CONFIGURED",
    });
  });
  it("never treats stale holder snapshots as eligible and never queries balances", async () => {
    jest
      .spyOn(holders, "readHoldersSnapshot")
      .mockReturnValue({
        fetchedAt: new Date(0).toISOString(),
        byAddress: new Map([
          [address, { holders: 101, holdersConfidence: "high", note: null }],
        ]),
      });
    const call = jest.fn(async (method: string) =>
      method === "eth_chainId"
        ? "0x38"
        : method === "eth_blockNumber"
          ? "0x1"
          : method === "eth_getCode"
            ? "0x1234"
            : "0x" + "0".repeat(64),
    );
    const provider = new FairMintProvider({ call } as unknown as RpcService);
    expect(await provider.gates(address)).toMatchObject({
      priceWei: "0",
      holders: 101,
      holdersVerified: false,
      previewRequired: true,
    });
    expect(
      call.mock.calls.every(([method]) =>
        ["eth_chainId", "eth_blockNumber", "eth_getCode", "eth_call"].includes(
          method,
        ),
      ),
    ).toBe(true);
  });
});
