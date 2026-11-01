import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { WalletScopeQuery } from "../wallet/wallet-scope.dto";
export class RunQuery extends WalletScopeQuery {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
export class BuyConfirmInput {
  @IsString() @Matches(/^(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?$/) amount: string;
  @IsIn(["BNB", "USDT"]) asset: "BNB" | "USDT";
  @IsOptional() @Matches(/^auto$|^\d{1,2}(?:\.\d{1,2})?$|^100$/) slippage =
    "auto";
  @IsString() @MaxLength(150) confirmationText: string;
}
export class ExecuteInput {
  @IsOptional() @IsUUID() confirmationId?: string;
  @IsOptional() @IsString() @MaxLength(150) confirmationText?: string;
}
