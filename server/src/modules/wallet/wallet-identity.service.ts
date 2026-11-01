import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AppError } from "../../common/http";
import { readLedgerIdentity } from "./wallet-delegation";

export { bscScope } from "./wallet-delegation";

@Injectable()
export class WalletIdentityService {
  constructor(private readonly db: PrismaService) {}
  async current(scope?: string) {
    if (!scope) return readLedgerIdentity();
    const known =
      (await this.db.executorSession.findFirst({
        where: { walletScope: scope },
      })) ||
      (await this.db.walletActivity.findFirst({
        where: { walletScope: scope },
        select: { id: true },
      }));
    if (!known)
      throw new AppError(
        "WALLET_SCOPE_UNKNOWN",
        "Wallet scope has not been registered or imported",
        404,
      );
    const address = scope.slice(4);
    return {
      scope,
      address,
      addresses: [{ binanceChainId: "56", chainName: "BSC", address }],
    };
  }
}
