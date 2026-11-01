import {
  evaluatePreview,
  projectPreview,
} from "../src/modules/execution/preview-gate";
import { FreeProof } from "../src/modules/execution/rpc.service";
import { commandArgs } from "../src/modules/wallet/command-args";
const address = "0x" + "1".repeat(40);
export const proof: FreeProof = {
  chainId: "56",
  from: address,
  to: address,
  inputData: "0x12345678",
  value: "0",
  block: "0x1",
  codeHash: "code",
  gasRequiredWei: "1",
  priceFields: [{ method: "price()", value: "0" }],
};
export function clean() {
  return {
    requestId: "request-id",
    parsedTx: { transactionType: "Call", amount: "0" },
    simulationResult: {
      simulationCode: "000000000",
      preCheckCode: "",
      balanceChanges: [],
      allowanceChanges: [],
      authorityChanges: [],
    },
    risks: { riskDetails: [], addresses: {}, riskBehaviors: [] },
    requireConfirmation: false,
    expiresAt: Date.now() + 60000,
  };
}
describe("Fail-closed free Mint gate", () => {
  it("accepts complete clean zero-value evidence", () => {
    expect(evaluatePreview(projectPreview(clean()), proof).decision).toBe(
      "ALLOW",
    );
  });
  it.each([
    [
      "risk",
      {
        risks: {
          riskDetails: [{ title: "Risk" }],
          addresses: {},
          riskBehaviors: [],
        },
      },
    ],
    ["missing risks", { risks: {} }],
    ["missing preview", { requestId: "" }],
    ["expired", { expiresAt: Date.now() - 1 }],
    ["nonzero parsed value", { parsedTx: { amount: "1" } }],
    ["missing confirmation policy", { requireConfirmation: undefined }],
    [
      "failed simulation",
      {
        simulationResult: {
          ...clean().simulationResult,
          simulationCode: "FAILED",
        },
      },
    ],
    [
      "approval",
      {
        simulationResult: {
          ...clean().simulationResult,
          allowanceChanges: [{ amount: "100" }],
        },
      },
    ],
    [
      "authority",
      {
        simulationResult: {
          ...clean().simulationResult,
          authorityChanges: [{ spender: address }],
        },
      },
    ],
    [
      "principal loss",
      {
        simulationResult: {
          ...clean().simulationResult,
          balanceChanges: [{ tokenAddress: address, changeAmount: "-1" }],
        },
      },
    ],
    [
      "unknown asset change",
      {
        simulationResult: {
          ...clean().simulationResult,
          balanceChanges: [{ unknown: "data" }],
        },
      },
    ],
  ])("denies %s", (_name, patch) => {
    expect(() =>
      evaluatePreview(projectPreview({ ...clean(), ...patch }), proof),
    ).toThrow();
  });
  it("rejects nonzero transaction value even with clean preview", () => {
    expect(() =>
      evaluatePreview(projectPreview(clean()), { ...proof, value: "1" }),
    ).toThrow();
  });
  it("projects away CLI session credentials", () => {
    const p = projectPreview({
      ...clean(),
      sessionToken: "secret",
      parsedTx: { amount: "0", sessionToken: "secret" },
    });
    expect(JSON.stringify(p)).not.toContain("secret");
  });
  it("hardcodes zero value and validates command arguments", () => {
    const args = commandArgs("contractPreview", {
      chainId: "56",
      from: address,
      to: address,
      inputData: "0x12345678",
    });
    expect(
      args.slice(args.indexOf("--value"), args.indexOf("--value") + 2),
    ).toEqual(["--value", "0"]);
    expect(() =>
      commandArgs("contractExecute", { requestId: "id;rm" }),
    ).toThrow();
    expect(() =>
      commandArgs("swap", {
        chainId: "56",
        fromToken: address,
        toToken: address,
        amount: "0",
      }),
    ).toThrow();
  });
});
