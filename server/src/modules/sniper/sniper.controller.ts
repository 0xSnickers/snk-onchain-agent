import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { SniperService } from "./sniper.service";
import { AddSniperTarget, ConfirmSniper, PreviewSniper, UpdateSniperControls } from "./sniper.dto";

@Controller("sniper")
export class SniperController {
  constructor(private readonly sniper: SniperService) {}

  @Get("board")
  board() {
    return this.sniper.board();
  }

  @Patch("controls")
  controls(@Body() body: UpdateSniperControls) {
    return this.sniper.updateControls(body);
  }

  @Post("targets")
  add(@Body() body: AddSniperTarget) {
    return this.sniper.add(body.contractAddress);
  }

  @Post("targets/:id/arm")
  arm(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.sniper.arm(id);
  }

  @Post("targets/:id/disarm")
  disarm(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.sniper.disarm(id);
  }

  @Post("targets/:id/preview")
  preview(@Param("id", new ParseUUIDPipe()) id: string, @Body() body: PreviewSniper) {
    return this.sniper.preview(id, body.amount);
  }

  @Post("targets/:id/confirm")
  confirm(@Param("id", new ParseUUIDPipe()) id: string, @Body() body: ConfirmSniper) {
    return this.sniper.confirm(id, body);
  }
}
