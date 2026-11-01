import {
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  IsInt,
  Min,
  IsIn,
  IsOptional,
  IsUUID,
  IsString,
  MaxLength,
  ValidateIf,
  Matches,
} from "class-validator";
import { BuyConfirmInput } from "../agent-runs/agent.dto";
export class SessionInput {
  @Matches(/^EVM:0x(?!0{40}$)[0-9a-f]{40}$/) walletScope: string;
  @IsIn(["CONNECTED", "UNCONNECTED"]) state: string;
  @IsOptional() @IsBoolean() paused?: boolean;
}
export const executorIdPattern = /^[a-z][a-z0-9_-]{0,31}$/;
export class ExecutorPath {
  @Matches(executorIdPattern) id: string;
}
export class QueueQuery {
  @IsOptional() @Matches(executorIdPattern) executorId?: string;
}
export class ClaimInput {
  @Matches(executorIdPattern) executorId: string;
  @Matches(/^EVM:0x(?!0{40}$)[0-9a-f]{40}$/) walletScope: string;
}
export class ResultInput extends ClaimInput {
  @IsUUID() claimToken: string;
  @IsIn(["SUBMITTED", "SUCCEEDED", "FAILED", "UNKNOWN"]) status: string;
  @IsOptional() @Matches(/^0x[0-9a-fA-F]{64}$/) txHash?: string;
  @IsOptional() @Matches(/^[A-Z][A-Z0-9_]{0,79}$/) errorCode?: string;
  @IsOptional() @IsBoolean() previewClean?: boolean;
  @IsOptional() @Matches(/^0$/) priceWei?: string;
  @IsOptional() @IsInt() @Min(101) holders?: number;
  @IsOptional() @Matches(/^[a-zA-Z0-9_-]{1,100}$/) previewRequestId?: string;
  @IsOptional() @Matches(/^[a-zA-Z0-9_-]{1,100}$/) orderId?: string;
  @IsOptional() @IsIn(["SUCCESS", "COMPLETED"]) orderStatus?: string;
}
export class DelegatedBuyInput extends BuyConfirmInput {
  @Matches(/^EVM:0x(?!0{40}$)[0-9a-f]{40}$/) walletScope: string;
}

export class ExecutorMetadataInput {
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsIn(["MONITOR", "FREE_MINT", "PAID", "STANDBY", "COLLAB"], { each: true })
  sourceRoles?: string[];
  @IsOptional() @Matches(/^[a-zA-Z0-9._-]{1,100}$/) agentId?: string | null;
}
export class ExecutorCreateInput extends ExecutorMetadataInput {
  @Matches(executorIdPattern) id: string;
  @Matches(/^EVM:0x(?!0{40}$)[0-9a-f]{40}$/) walletScope: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(80)
  label = "";
  @IsIn(["MONITOR", "FREE_MINT", "PAID"]) role: string;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() isDefault = false;
}
export class ExecutorUpdateInput extends ExecutorMetadataInput {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(80)
  label?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(["MONITOR", "FREE_MINT", "PAID"])
  role?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isDefault?: boolean;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() paused?: boolean;
}
