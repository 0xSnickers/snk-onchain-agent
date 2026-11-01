import {
  parseMintLedger,
  normalizeLedgerScope,
} from "../src/modules/wallet/ledger-parser";
const mixed = "0x" + "aB".repeat(20),
  other = "0x" + "cD".repeat(20),
  contract = "0x" + "12".repeat(20);
const doc = { walletAddress: mixed, walletScope: "EVM:" + mixed, mints: [] };
describe("Ledger identity normalization", () => {
  it("accepts legacy checksum casing and returns the canonical partition", () => {
    expect(parseMintLedger(doc)).toMatchObject({
      address: mixed.toLowerCase(),
      scope: "EVM:" + mixed.toLowerCase(),
    });
    expect(normalizeLedgerScope("EVM:" + mixed)).toBe(
      "EVM:" + mixed.toLowerCase(),
    );
  });
  it("does not weaken actual wallet mismatch validation", () => {
    expect(() =>
      parseMintLedger({ ...doc, walletScope: "EVM:" + other }),
    ).toThrow(expect.objectContaining({ code: "LEDGER_INVALID" }));
    for (const scope of ["EVM:bad", "", null, "EVM:0x" + "0".repeat(40)])
      expect(() => parseMintLedger({ ...doc, walletScope: scope })).toThrow();
  });
  it("normalizes row scopes while excluding other wallets' contracts", () => {
    expect(
      parseMintLedger({
        ...doc,
        mints: [
          { walletScope: "EVM:" + mixed, contractAddress: contract },
          { walletScope: "EVM:" + other, contractAddress: other },
        ],
      }).contracts,
    ).toEqual([{ address: contract, name: "Token" }]);
  });
  it("accepts legacy entries with an omitted scope and rejects malformed row scopes", () => {
    expect(
      parseMintLedger({
        ...doc,
        walletScope: undefined,
        mints: [{ contractAddress: contract }],
      }).contracts,
    ).toHaveLength(1);
    expect(() =>
      parseMintLedger({
        ...doc,
        mints: [{ walletScope: "invalid", contractAddress: contract }],
      }),
    ).toThrow();
  });
});
