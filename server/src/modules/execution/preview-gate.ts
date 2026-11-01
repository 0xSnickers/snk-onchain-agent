import { object, text } from "../../common/safe-data";
import { AppError } from "../../common/http";
import { FreeProof } from "./rpc.service";
export interface Preview {
  requestId: string;
  parsedTx: Record<string, unknown>;
  simulationResult: Record<string, unknown>;
  risks: Record<string, unknown>;
  requireConfirmation: boolean;
  expiresAt: number;
}
export function projectPreview(raw: Record<string, unknown>): Preview {
  const sim = object(raw.simulationResult),
    risk = object(raw.risks),
    parsed = object(raw.parsedTx);
  const list = (value: unknown, keys: string[]) =>
    Array.isArray(value)
      ? value.slice(0, 100).map((v) => {
          const row = object(v);
          return Object.fromEntries(
            keys
              .filter((k) => row[k] !== undefined)
              .map((k) => [
                k,
                typeof row[k] === "number" ? row[k] : text(row[k], 1000),
              ]),
          );
        })
      : null;
  const presence = (value: unknown) =>
    Array.isArray(value)
      ? value.slice(0, 100).map(() => ({ present: true }))
      : null;
  const addressRisks =
    risk.addresses &&
    typeof risk.addresses === "object" &&
    !Array.isArray(risk.addresses)
      ? Object.fromEntries(
          Object.entries(object(risk.addresses))
            .slice(0, 100)
            .map(([address, value]) => [
              address,
              {
                riskLevel: object(value).riskLevel ?? null,
                riskDetails: list(object(value).riskDetails, [
                  "code",
                  "title",
                  "description",
                  "riskType",
                ]),
              },
            ]),
        )
      : null;
  return {
    requestId: text(raw.requestId, 160),
    expiresAt: Number(raw.expiresAt),
    requireConfirmation: raw.requireConfirmation as boolean,
    parsedTx: Object.fromEntries(
      ["transactionType", "amount", "recipient", "contractAddress", "memo"]
        .filter((k) => parsed[k] !== undefined)
        .map((k) => [
          k,
          typeof parsed[k] === "number" ? parsed[k] : text(parsed[k], 1000),
        ]),
    ),
    simulationResult: {
      simulationCode: sim.simulationCode,
      preCheckCode: sim.preCheckCode,
      balanceChanges: list(sim.balanceChanges, [
        "tokenAddress",
        "changeAmount",
        "balanceChange",
      ]),
      allowanceChanges: presence(sim.allowanceChanges),
      authorityChanges: presence(sim.authorityChanges),
    },
    risks: {
      riskDetails: list(risk.riskDetails, [
        "code",
        "title",
        "description",
        "riskType",
      ]),
      addresses: addressRisks,
      riskBehaviors: presence(risk.riskBehaviors),
    },
  };
}
export function evaluatePreview(p: Preview, proof: FreeProof) {
  const deny = (message: string): never => {
    throw new AppError("PREVIEW_RISKY", message, 409);
  };
  if (proof.value !== "0") deny("Transaction value must be exactly zero");
  if (!p.requestId || !/^[a-zA-Z0-9_.-]{1,160}$/.test(p.requestId))
    throw new AppError("PREVIEW_FAILED", "No usable preview requestId", 409);
  if (!Number.isFinite(p.expiresAt) || p.expiresAt <= Date.now() + 5000)
    throw new AppError(
      "PREVIEW_EXPIRED",
      "Preview expired; create a new run",
      409,
    );
  if (typeof p.requireConfirmation !== "boolean")
    deny("Missing confirmation policy");
  if (!Object.keys(p.parsedTx).length) deny("Missing parsed transaction");
  const amount = p.parsedTx.amount;
  if (amount !== undefined && !/^(0|0x0+)$/.test(String(amount)))
    deny("Parsed transaction contains a nonzero amount");
  const sim = p.simulationResult;
  if (
    sim.simulationCode !== "000000000" ||
    !["", "000000000"].includes(String(sim.preCheckCode))
  )
    deny("Simulation did not succeed");
  for (const key of ["allowanceChanges", "authorityChanges"])
    if (!Array.isArray(sim[key]) || sim[key].length)
      deny("Missing or nonempty authority/allowance changes");
  for (const key of ["riskDetails", "riskBehaviors"])
    if (!Array.isArray(p.risks[key]) || p.risks[key].length)
      deny("Missing or nonempty risk items");
  if (
    !p.risks.addresses ||
    Array.isArray(p.risks.addresses) ||
    typeof p.risks.addresses !== "object" ||
    Object.keys(object(p.risks.addresses)).length
  )
    deny("Missing or nonempty address risks");
  if (!Array.isArray(sim.balanceChanges))
    deny("Missing balance change evidence");
  for (const item of sim.balanceChanges as unknown[]) {
    const c = object(item),
      amount = c.changeAmount ?? c.balanceChange;
    if (
      typeof amount !== "string" ||
      !/^\+?\d+(\.\d+)?$/.test(amount) ||
      String(c.tokenAddress).toLowerCase() !== proof.to.toLowerCase()
    )
      deny("Unexpected asset change; cannot prove principal is untouched");
  }
  return {
    decision: "ALLOW",
    requestId: p.requestId,
    requiresApp: p.requireConfirmation,
  };
}
