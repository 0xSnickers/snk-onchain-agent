import { CandidateOutbox, MintCandidate } from "@prisma/client";
import { RpcService } from "../execution/rpc.service";
import { AppError } from "../../common/http";
import { ResultInput } from "./delegation.dto";
export async function verifyResult(
  row: CandidateOutbox,
  c: MintCandidate,
  input: ResultInput,
  rpc: RpcService,
) {
  const txHash = input.txHash?.toLowerCase();
  if (
    input.status === "SUCCEEDED" &&
    row.kind === "FREE_MINT" &&
    (input.previewClean !== true ||
      input.priceWei !== "0" ||
      !input.holders ||
      input.holders <= 100 ||
      !input.previewRequestId)
  )
    throw new AppError(
      "GATE_EVIDENCE_REQUIRED",
      "Free mint requires the executor's clean preview, zero price and >100 holders report",
      409,
    );
  if (
    input.status === "SUCCEEDED" &&
    row.kind === "PAID_BUY" &&
    (!input.orderId || !input.orderStatus)
  )
    throw new AppError(
      "ORDER_NOT_FINAL",
      "Paid buy requires the executor's successful terminal order report",
      409,
    );
  let txTime: Date | null = null;
  if (
    input.status === "SUCCEEDED" &&
    row.kind !== "PAID_RESEARCH" &&
    row.status !== "SUCCEEDED"
  ) {
    if ((await rpc.call<string>("eth_chainId", [])) !== "0x38")
      throw new AppError("RPC_CHAIN_MISMATCH", "Result must be on BSC", 409);
    const receipt = await rpc.receipt(txHash!);
    const tx = await rpc.call<{
      from: string;
      to: string;
      value: string;
      input: string;
    } | null>("eth_getTransactionByHash", [txHash]);
    if (receipt) {
      const block = await rpc.call<{ timestamp: string }>(
        "eth_getBlockByNumber",
        [receipt.blockNumber, false],
      );
      if (!/^0x[0-9a-f]+$/i.test(block.timestamp))
        throw new AppError(
          "RESULT_UNVERIFIED",
          "Receipt block timestamp missing",
          409,
        );
      txTime = new Date(Number(BigInt(block.timestamp)) * 1000);
    }
    const payload = row.payload as { inputData?: string };
    if (
      !receipt ||
      receipt.status !== "0x1" ||
      !tx ||
      `EVM:${tx.from.toLowerCase()}` !== row.walletScope
    )
      throw new AppError(
        "RESULT_UNVERIFIED",
        "Receipt not final/successful or transaction wallet mismatch",
        409,
      );
    if (
      row.kind === "FREE_MINT" &&
      (tx.to?.toLowerCase() !== c.contractAddress ||
        BigInt(tx.value) !== 0n ||
        tx.input.toLowerCase() !== payload.inputData?.toLowerCase())
    )
      throw new AppError(
        "RESULT_UNVERIFIED",
        "Free mint transaction does not match the candidate/value/calldata",
        409,
      );
  }
  return txTime;
}
