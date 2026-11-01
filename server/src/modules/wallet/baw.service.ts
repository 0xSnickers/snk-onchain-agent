import { Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import { AppError } from "../../common/http";
import { Command, WalletInput, commandArgs } from "./command-args";
import { agentEnv } from "../../config/agent-env";
export type { Command } from "./command-args";
@Injectable()
export class BawService {
  run<T = Record<string, unknown>>(
    command: Command,
    input?: string | WalletInput,
  ): Promise<T> {
    const args = commandArgs(command, input);
    return new Promise((resolve, reject) => {
      execFile(
        agentEnv.bawPath,
        args,
        {
          timeout: command === "verify" ? 310000 : 25000,
          maxBuffer: 2 * 1024 * 1024,
        },
        (error, stdout) => {
          // Do not log stdout/stderr: auth results can contain session credentials.
          try {
            const result = JSON.parse(stdout) as {
              success: boolean;
              data: T;
              error?: { name?: string; message?: string };
            };
            if (!result.success)
              return reject(
                new AppError(
                  result.error?.name || "WALLET_ERROR",
                  result.error?.message || "Wallet command failed",
                ),
              );
            resolve(result.data);
          } catch {
            reject(
              new AppError(
                "WALLET_UNAVAILABLE",
                error && "code" in error && error.code === "ENOENT"
                  ? "baw CLI is not installed"
                  : "Wallet command timed out or returned invalid JSON",
              ),
            );
          }
        },
      );
    });
  }
}
