import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";

export function createRequestLoggerMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startNs = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
      logger.info(
        {
          requestId: req.requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
        },
        "HTTP request completed",
      );
    });

    next();
  };
}
