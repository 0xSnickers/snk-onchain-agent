import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { ActivityService } from "./activity.service";
import { WalletScopeQuery } from "../wallet/wallet-scope.dto";
export class ActivityQuery extends WalletScopeQuery {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @IsIn(["ALL", "TRADE", "MINT", "TRANSFER", "CONTRACT"]) type =
    "ALL";
}
export class HistorySyncInput {
  @IsOptional() @IsString() @MaxLength(512) cursor?: string;
}
@Controller("wallet/activity")
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}
  @Get() list(@Query() query: ActivityQuery) {
    return this.activity.list(query.cursor, query.type, query.walletScope);
  }
  @Post("sync") sync(@Body() input: HistorySyncInput) {
    void input;
    return this.activity.sync();
  }
}
