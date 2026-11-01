import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { DelegationRepository } from "./delegation.repository";
import { DelegationService } from "./delegation.service";
import { DelegatedResultService } from "./result.service";
import {
  SessionInput,
  ClaimInput,
  ResultInput,
  QueueQuery,
  DelegatedBuyInput,
  ExecutorPath,
  ExecutorCreateInput,
  ExecutorUpdateInput,
} from "./delegation.dto";
@Controller("delegation")
export class DelegationController {
  constructor(
    private readonly repo: DelegationRepository,
    private readonly service: DelegationService,
    private readonly results: DelegatedResultService,
  ) {}
  @Get("scans") scans() {
    return this.repo.scans();
  }
  @Get("sessions") async sessions() {
    return (await this.repo.sessions()).map((s) => ({
      ...s,
      online:
        s.state === "CONNECTED" &&
        !s.paused &&
        !!s.heartbeatAt &&
        Date.now() - s.heartbeatAt.getTime() <= 120000,
    }));
  }
  @Post("sessions/:id") session(
    @Param() params: ExecutorPath,
    @Body() input: SessionInput,
  ) {
    return this.repo.session(params.id, input);
  }
  @Post("executors") register(@Body() input: ExecutorCreateInput) {
    return this.repo.createExecutor(input);
  }
  @Patch("executors/:id") update(
    @Param() params: ExecutorPath,
    @Body() input: ExecutorUpdateInput,
  ) {
    return this.repo.updateExecutor(params.id, input);
  }
  @Get("outbox") async outbox(@Query() q: QueueQuery) {
    await this.repo.expire();
    return (await this.repo.list(q.executorId)).map(
      ({ claimToken: _token, ...r }) => {
        void _token;
        return r;
      },
    );
  }
  @Post("candidates/:id/queue") async queue(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: QueueQuery,
  ) {
    const { claimToken: _token, ...row } = await this.service.queue(
      id,
      input.executorId,
    );
    void _token;
    return row;
  }
  @Post("briefs/:id/confirm-buy") async confirm(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: DelegatedBuyInput,
  ) {
    const { claimToken: _token, ...row } = await this.service.confirm(
      id,
      input,
    );
    void _token;
    return row;
  }
  @Post("outbox/:id/claim") claim(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ClaimInput,
  ) {
    return this.repo.claim(id, input);
  }
  @Post("outbox/:id/result") result(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ResultInput,
  ) {
    return this.results.result(id, input);
  }
}
