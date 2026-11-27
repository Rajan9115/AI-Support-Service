import mongoose from "mongoose";
import type { Logger } from "pino";

export interface MongoLifecycle {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isReady: () => Promise<boolean>;
}

export function createMongoLifecycle(uri: string, logger: Logger): MongoLifecycle {
  let listenersAttached = false;

  const attachListeners = (): void => {
    if (listenersAttached) return;
    listenersAttached = true;

    mongoose.connection.on("error", (err: unknown) => {
      logger.error({ err }, "MongoDB connection error");
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });
  };

  return {
    async connect(): Promise<void> {
      attachListeners();
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 20000,
      });
      logger.info("MongoDB connected");
    },

    async disconnect(): Promise<void> {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        logger.info("MongoDB disconnected cleanly");
      }
    },

    async isReady(): Promise<boolean> {
      if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
        return false;
      }
      try {
        await mongoose.connection.db.admin().ping();
        return true;
      } catch {
        return false;
      }
    },
  };
}
