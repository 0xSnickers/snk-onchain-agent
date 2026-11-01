import { IsOptional, Matches } from "class-validator";
export class WalletScopeQuery {
  @IsOptional() @Matches(/^EVM:0x(?!0{40}$)[0-9a-f]{40}$/) walletScope?: string;
}
