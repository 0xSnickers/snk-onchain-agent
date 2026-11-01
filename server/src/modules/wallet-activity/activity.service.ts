import { Injectable } from "@nestjs/common";
import { WalletIdentityService } from "../wallet/wallet-identity.service";
import { refuseLiveWallet } from "../wallet/wallet-delegation";
import { ActivityRepository } from "./activity.repository";
@Injectable()
export class ActivityService {
  constructor(
    private readonly identity: WalletIdentityService,
    private readonly repository: ActivityRepository,
  ) {}
  async list(cursor?: string, type?: string, scope?: string) {
    const wallet = await this.identity.current(scope);
    return {
      walletAddress: wallet.address,
      walletScope: wallet.scope,
      source: "BINANCE_AGENTIC_WALLET",
      ...(await this.repository.list(wallet.scope, cursor, type)),
    };
  }
  sync(): never {
    refuseLiveWallet();
  }
}
