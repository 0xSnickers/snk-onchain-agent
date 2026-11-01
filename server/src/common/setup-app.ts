import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import type { Request, Response, NextFunction } from "express";
import { Errors, Envelope } from "./http";
import { env } from "../config/env";
export function setupApp(app: INestApplication) {
  app.use(helmet());
  // Local companion process: reject remote hosts, cross-origin requests and DNS rebinding.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const local = (value: string) => {
      try {
        const u = new URL(value);
        return (
          ["localhost", "127.0.0.1"].includes(u.hostname) &&
          ["http:", "https:"].includes(u.protocol)
        );
      } catch {
        return false;
      }
    };
    if (
      !local(`http://${req.headers.host}`) ||
      (req.headers.origin &&
        ![
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          `http://localhost:${env.port}`,
          `http://127.0.0.1:${env.port}`,
        ].includes(req.headers.origin))
    ) {
      res.status(403).json({
        code: "LOCAL_ONLY",
        message: "Local requests only",
        data: null,
      });
      return;
    }
    next();
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new Envelope());
  app.useGlobalFilters(new Errors());
}
