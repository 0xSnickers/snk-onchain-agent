import { RpcService } from "../../src/modules/execution/rpc.service";
import { NetworkService } from "../../src/common/network.service";
import { agentEnv } from "../../src/config/agent-env";
const address = "0x" + "1".repeat(40),
  mint = "0x12345678";
describe("Onchain free Mint proof", () => {
  const original = { ...agentEnv };
  afterEach(() => Object.assign(agentEnv, original));
  function fixture(mode = "free") {
    agentEnv.rpc = "http://127.0.0.1:8545";
    const network = {
      json: jest.fn().mockImplementation(async (_url, body) => {
        const { method, params } = body;
        if (method === "eth_chainId")
          return { result: mode === "wrong-chain" ? "0x1" : "0x38" };
        if (method === "eth_blockNumber") return { result: "0x10" };
        if (method === "eth_getCode")
          return { result: mode === "no-code" ? "0x" : "0x60006000" };
        if (method === "eth_call") {
          if (params[0].data === mint) {
            if (params[0].value === "0x1" && mode !== "accepts-value")
              return { error: { code: 3, message: "execution reverted" } };
            return { result: "0x" };
          }
          return {
            result:
              mode === "unknown-price"
                ? "0x"
                : "0x" + (mode === "paid" ? "1" : "0").padStart(64, "0"),
          };
        }
        if (method === "eth_estimateGas") return { result: "0x5208" };
        if (method === "eth_gasPrice") return { result: "0x3b9aca00" };
        if (method === "eth_getBalance")
          return { result: mode === "no-gas" ? "0x0" : "0xde0b6b3a7640000" };
        throw new Error("Unexpected method");
      }),
    };
    return new RpcService(network as unknown as NetworkService);
  }
  it("pins reads to a block and returns a zero-price gas-funded proof", async () => {
    const proof = await fixture().proveFree(address, address, mint);
    expect(proof.value).toBe("0");
    expect(proof.block).toBe("0x10");
    expect(proof.gasRequiredWei).toBe("26250000000000");
    expect(proof.priceFields).toHaveLength(5);
  });
  it.each([
    ["wrong-chain", "RPC_CHAIN_MISMATCH"],
    ["no-code", "NOT_A_CONTRACT"],
    ["paid", "NOT_FREE"],
    ["unknown-price", "PRICE_UNVERIFIED"],
    ["accepts-value", "PRICE_AMBIGUOUS"],
    ["no-gas", "ABORTED_INSUFFICIENT_GAS"],
  ])("stops %s before preview", async (mode, code) => {
    await expect(
      fixture(mode).proveFree(address, address, mint),
    ).rejects.toMatchObject({ code });
  });
});
