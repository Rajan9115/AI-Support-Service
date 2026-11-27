import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type Router } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { Logger } from "pino";
import { ERROR_CODES } from "@resolveai/shared";
import { forbiddenError } from "./errors/app-error.js";
import { sendError } from "./http/response.js";
import { createErrorHandlerMiddleware } from "./middleware/error-handler.js";
import { notFoundMiddleware } from "./middleware/not-found.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { createRequestLoggerMiddleware } from "./middleware/request-logger.js";
import { createHealthRouter, type ReadinessChecks } from "./routes/health.routes.js";

export interface CreateAppOptions {
  logger: Logger;
  allowedOrigins: string[];
  readinessChecks: ReadinessChecks;
  rateLimitMax?: number;
  v1Routers?: {
    auth: Router;
    organizations: Router;
    projects: Router;
  };
}

export function createApp(options: CreateAppOptions): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(createRequestLoggerMiddleware(options.logger));
  app.use(helmet());

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || options.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(forbiddenError("Origin not allowed by CORS policy."));
      },
      credentials: true,
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: options.rateLimitMax ?? 120,
      standardHeaders: true,
      legacyHeaders: false,
      handler(req, res) {
        sendError(res, {
          statusCode: 429,
          code: ERROR_CODES.RATE_LIMITED,
          message: "Too many requests. Please try again later.",
          requestId: req.requestId ?? "unknown",
        });
      },
    }),
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  app.use(createHealthRouter(options.readinessChecks));

  if (options.v1Routers) {
    app.use("/v1/auth", options.v1Routers.auth);
    app.use("/v1/organizations", options.v1Routers.organizations);
    app.use("/v1/projects", options.v1Routers.projects);
  }

  app.use(notFoundMiddleware);
  app.use(createErrorHandlerMiddleware(options.logger));

  return app;
}
