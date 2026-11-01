import { Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { AgentStore } from "../agent-runs/agent.store";
import { AppError } from "../../common/http";
import { object, text } from "../../common/safe-data";
import { evmAddress } from "../wallet/command-args";
@Injectable()
export class DiscoveryService {
  constructor(private readonly store: AgentStore) {}
  async discover() {
    const path =
      process.env.MEME_RUSH_CLI_PATH ||
      join(homedir(), ".agents/skills/meme-rush/scripts/cli.mjs");
    const rows = await new Promise<unknown[]>((resolve, reject) =>
      execFile(
        process.execPath,
        [
          path,
          "meme-rush",
          JSON.stringify({ chainId: "56", rankType: 10, limit: 10 }),
        ],
        { timeout: 20000, maxBuffer: 1024 * 1024 },
        (error, stdout) => {
          try {
            const r = JSON.parse(stdout);
            if (error || r.code !== "000000" || !Array.isArray(r.data))
              return reject(
                new AppError(
                  "DISCOVERY_UNAVAILABLE",
                  "Meme Rush discovery failed",
                ),
              );
            resolve(r.data);
          } catch {
            reject(
              new AppError(
                "DISCOVERY_UNAVAILABLE",
                "Meme Rush CLI unavailable or returned invalid JSON",
              ),
            );
          }
        },
      ),
    );
    let added = 0;
    for (const row of rows.map(object)) {
      if (String(row.chainId) !== "56" || !evmAddress(row.contractAddress))
        continue;
      await this.store.addCandidate({
        chainId: "56",
        contractAddress: row.contractAddress.toLowerCase(),
        class: "PAID_TOKEN",
        source: "MEME_RUSH",
        symbol: text(row.symbol, 30),
        name: text(row.name, 100),
        autoExecute: false,
      });
      added++;
    }
    return {
      source: "meme-rush",
      stage: "NEW",
      observed: rows.length,
      accepted: added,
      freeEligible: false,
    };
  }
}
