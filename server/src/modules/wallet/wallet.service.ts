import { Injectable } from "@nestjs/common";
import { refuseLiveWallet } from "./wallet-delegation";

@Injectable()
export class WalletService {
  status() {
    return { status: "DELEGATED", login: null };
  }
  overview(): never {
    refuseLiveWallet();
  }
  signin(): never {
    refuseLiveWallet();
  }
}
