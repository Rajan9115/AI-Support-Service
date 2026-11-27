import { Router, type Request, type Response } from "express";
import { ERROR_CODES } from "@resolveai/shared";
import { sendError, sendSuccess } from "../http/response.js";

export interface ReadinessChecks {
  checkMongo: () => Promise<boolean>;
  checkRedis: () => Promise<boolean>;
}

export function createHealthRouter(checks: ReadinessChecks): Router {
  const router = Router();

  router.get("/health", (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  router.get("/ready", async (req: Request, res: Response) => {
    const [mongoReady, redisReady] = await Promise.all([
      checks.checkMongo().catch(() => false),
      checks.checkRedis().catch(() => false),
    ]);

    const dependencies = {
      mongodb: mongoReady ? "up" : "down",
      redis: redisReady ? "up" : "down",
    };

    if (!mongoReady || !redisReady) {
      sendError(res, {
        statusCode: 503,
        code: ERROR_CODES.DEPENDENCY_UNAVAILABLE,
        message: "One or more required dependencies are unavailable.",
        details: [dependencies],
        requestId: req.requestId ?? "unknown",
      });
      return;
    }

    sendSuccess(res, {
      status: "ready",
      dependencies,
    });
  });

  return router;
}
