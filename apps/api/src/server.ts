import type { Server } from "node:http";
import { createApp } from "./app.js";
import { getAllowedDashboardOrigins, loadApiEnv } from "./config/env.js";
import { createMongoLifecycle } from "./infrastructure/database/mongo.js";
import { createLogger } from "./infrastructure/logger/logger.js";
import { createRedisLifecycle } from "./infrastructure/redis/redis.js";

async function startServer(): Promise<void> {
  const env = loadApiEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const mongo = createMongoLifecycle(env.MONGODB_URI, logger);
  const redis = createRedisLifecycle(env.REDIS_URL, logger);

  await mongo.connect();
  await redis.connect();

  const app = createApp({
    logger,
    allowedOrigins: getAllowedDashboardOrigins(env),
    readinessChecks: {
      checkMongo: mongo.isReady,
      checkRedis: redis.isReady,
    },
  });

  const server: Server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "ResolveAI API server listening");
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, "Graceful shutdown initiated");

    const closeHttp = new Promise<void>((resolve) => {
      server.close(() => {
        logger.info("HTTP server closed");
        resolve();
      });
    });

    const forceTimeout = setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
    forceTimeout.unref();

    try {
      await closeHttp;
      await Promise.allSettled([mongo.disconnect(), redis.disconnect()]);
      clearTimeout(forceTimeout);
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during graceful shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

void startServer().catch((err: unknown) => {
  const fallbackLogger = createLogger("error");
  fallbackLogger.fatal({ err }, "Failed to start ResolveAI API server");
  process.exit(1);
});
