import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { map } from "rxjs/operators";
import type { Response } from "express";
export class AppError extends HttpException {
  constructor(
    public code: string,
    message: string,
    status = 502,
  ) {
    super(message, status);
  }
}
@Injectable()
export class Envelope implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next
      .handle()
      .pipe(map((data: unknown) => ({ code: 0, message: "OK", data })));
  }
}
@Catch()
export class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const response =
      error instanceof HttpException ? error.getResponse() : null;
    const message =
      error instanceof HttpException
        ? typeof response === "object" && response && "message" in response
          ? response.message
          : error.message
        : "Internal server error";
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        code:
          error instanceof AppError
            ? error.code
            : status === 400
              ? "VALIDATION_ERROR"
              : "REQUEST_FAILED",
        message,
        data: null,
      });
  }
}
