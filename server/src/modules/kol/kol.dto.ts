import { IsString, Length, Matches, IsOptional, IsIn } from "class-validator";
import { KOL_CATEGORIES } from "./kol-categories";
const categories = [...KOL_CATEGORIES];
export class CreateKol {
  @IsString() @Matches(/^[A-Za-z0-9_]{1,15}$/) handle: string;
  @IsOptional() @IsIn(categories) category = "DAILY";
  @IsOptional() @IsString() @Length(0, 500) note = "";
}

export class UpdateKol {
  @IsString() @Matches(/^[A-Za-z0-9_]{1,15}$/) handle: string;
  @IsIn(categories) category: string;
}
