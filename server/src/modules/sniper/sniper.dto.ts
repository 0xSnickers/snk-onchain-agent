import { IsBoolean, IsIn, IsInt, IsString, Length, Matches, Max, Min } from "class-validator";

const amount = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

export class UpdateSniperControls {
  @IsBoolean() armed: boolean;
  @IsInt() @Min(60) @Max(70) minProgress: number;
  @IsInt() @Min(100) @Max(130) minAgentWallets: number;
  @IsInt() @Min(1) @Max(20) maxUsd: number;
  @IsInt() @Min(1) @Max(60) dailyUsdCap: number;
}

export class AddSniperTarget {
  @IsString()
  @Matches(/^0x(?!0{40}$)[0-9a-fA-F]{40}$/)
  contractAddress: string;
}

export class PreviewSniper {
  @IsString() @Matches(amount) amount: string;
}

export class ConfirmSniper {
  @IsString() @Matches(amount) amount: string;
  @IsIn(["USDT"]) asset: "USDT";
  @IsString() @Length(1, 80) confirmationText: string;
}
