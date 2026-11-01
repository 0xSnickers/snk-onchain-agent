import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import { IsBoolean, IsOptional } from "class-validator";
import { KolSyncService } from "./kol-sync.service";
import { KolSharedSyncService } from "./kol-shared-sync.service";
class SyncKolInput {
  @IsOptional() @IsBoolean() more = false;
}
import { KolService } from "./kol.service";
import { CreateKol, UpdateKol } from "./kol.dto";
@Controller("kols")
export class KolController {
  constructor(
    private readonly kol: KolService,
    private readonly syncService: KolSyncService,
    private readonly shared: KolSharedSyncService,
  ) {}
  @Get() list() {
    return this.kol.list();
  }
  @Get("reports")
  reports() {
    return this.shared.reports();
  }
  @Post() add(@Body() input: CreateKol) {
    return this.kol.add(input);
  }
  @Post("sync-shared")
  syncShared() {
    return this.shared.sync();
  }
  @Patch(":id") update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: UpdateKol,
  ) {
    return this.kol.update(id, input);
  }
  @Get(":id/posts") posts(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.syncService.posts(id);
  }
  @Post(":id/sync") sync(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: SyncKolInput,
  ) {
    return this.syncService.sync(id, input.more);
  }
  @Delete(":id") remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.kol.remove(id);
  }
}
