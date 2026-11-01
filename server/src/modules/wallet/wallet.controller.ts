import { Controller, Get, Post, Query } from "@nestjs/common";
import { WalletScopeQuery } from "./wallet-scope.dto";
import { HoldingsService } from "./holdings.service";
import { WalletIdentityService } from "./wallet-identity.service";
import { WalletService } from "./wallet.service";
@Controller("wallet")
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly identity: WalletIdentityService,
    private readonly holdings: HoldingsService,
  ) {}
  @Get("identity") identityView(@Query() q: WalletScopeQuery) {
    return this.identity.current(q.walletScope);
  }
  @Get("holdings") holdingsView() {
    return this.holdings.current();
  }
  @Get("status") status() {
    return this.wallet.status();
  }
  @Get("overview") overview() {
    return this.wallet.overview();
  }
  @Post("signin") signin() {
    return this.wallet.signin();
  }
}
