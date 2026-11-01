import { IsIn, IsOptional, IsString, Length, Matches } from "class-validator";
export class MarketChainQuery {
  @IsOptional() @IsIn(["bsc", "solana"]) chain = "bsc";
}
export class MarketQuery extends MarketChainQuery {
  @IsOptional() @IsString() @Length(1, 80) q = "BNB";
}
export class KlineQuery extends MarketChainQuery {
  @IsString()
  @Matches(/^(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/)
  address!: string;
  @IsOptional() @IsIn(["1m", "5m", "15m", "1h", "4h", "1d"]) resolution = "15m";
}
export function validMarketAddress(chain: string, address: string) {
  return chain === "bsc"
    ? /^0x[0-9a-fA-F]{40}$/.test(address)
    : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export class AgentLaunchQuery {
  @IsOptional() @IsIn(["bsc"]) chain = "bsc";
}
