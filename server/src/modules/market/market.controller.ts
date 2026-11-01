import { Controller, Get, Query } from "@nestjs/common";
import { MarketService } from "./market.service";
import { MarketQuery, MarketChainQuery, KlineQuery } from "./market.dto";
import { AgentLaunchService } from "./agent-launch.service";
import { AgentLaunchQuery } from "./market.dto";
@Controller("market")
export class MarketController {
  constructor(
    private readonly market: MarketService,
    private readonly launches: AgentLaunchService,
  ) {}
  @Get("agent-launches") agentLaunches(@Query() _query: AgentLaunchQuery) {
    void _query;
    return this.launches.list();
  }
  @Get("pairs") search(@Query() query: MarketQuery) {
    return this.market.search(query.q, query.chain);
  }
  @Get("tokens") tokens(@Query() query: MarketChainQuery) {
    return this.market.trending(query.chain);
  }
  @Get("kline") kline(@Query() query: KlineQuery) {
    return this.market.kline(query.chain, query.address, query.resolution);
  }
}
