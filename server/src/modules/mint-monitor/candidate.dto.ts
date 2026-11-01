import { Transform } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  IsBoolean,
} from "class-validator";
export class CandidateInput {
  @IsOptional() @IsIn(["56"]) chainId = "56";
  @Transform(({ value }) =>
    typeof value === "string" ? value.toLowerCase() : value,
  )
  @Matches(/^0x(?!0{40}$)[0-9a-f]{40}$/)
  contractAddress: string;
  @IsOptional() @IsString() @MaxLength(100) name = "";
  @IsOptional() @IsString() @MaxLength(30) symbol = "";
  @IsOptional() @IsIn(["UNKNOWN", "FREE_MINT", "PAID_TOKEN"]) class = "UNKNOWN";
  @IsOptional() @Matches(/^0x(?:[0-9a-fA-F]{2}){4,4096}$|^0x$/) inputData =
    "0x";
  @IsOptional() @IsBoolean() autoExecute = false;
}
