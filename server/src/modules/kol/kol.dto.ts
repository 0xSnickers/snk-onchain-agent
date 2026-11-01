import { IsString, Length, Matches, IsOptional, IsIn } from "class-validator";
export class CreateKol {
  @IsString() @Matches(/^[A-Za-z0-9_]{1,15}$/) handle: string;
  @IsOptional() @IsIn(["DAILY", "MEME", "AIRDROP"]) category = "DAILY";
  @IsOptional() @IsString() @Length(0, 500) note = "";
}

export class UpdateKol {
  @IsString() @Matches(/^[A-Za-z0-9_]{1,15}$/) handle: string;
  @IsIn(["DAILY", "MEME", "AIRDROP"]) category: string;
}
