import { Redis } from "ioredis";
import type { Logger } from "pino";

export interface RedisLifecycle {
  client: Redis;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isReady: () => Promise<boolean>;
}

export function createRedisLifecycle(url: string, logger: Logger): RedisLifecycle {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
    enableReadyCheck: true,
  });

  client.on("error", (err: unknown) => {
    logger.error({ err }, "Redis client error");
  });

  return {
    client,

    async connect(): Promise<void> {
      await client.connect();
      logger.info("Redis connected");
    },

    async disconnect(): Promise<void> {
      if (client.status !== "end") {
        await client.quit();
        logger.info("Redis disconnected cleanly");
      }
    },

    async isReady(): Promise<boolean> {
      if (client.status !== "ready") {
        return false;
      }
      try {
        const pong = await client.ping();
        return pong === "PONG";
      } catch {
        return false;
      }
    },
  };
}
