import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createLogger } from "../infrastructure/logger/logger.js";

const silentLogger = createLogger("silent");

describe("health and readiness endpoints", () => {
  it("GET /health returns 200 and X-Request-Id", async () => {
    const app = createApp({
      logger: silentLogger,
      allowedOrigins: ["http://localhost:3000"],
      readinessChecks: {
        checkMongo: async () => true,
        checkRedis: async () => true,
      },
    });

    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBeTruthy();
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
  });

  it("GET /ready returns 200 when MongoDB and Redis are up", async () => {
    const app = createApp({
      logger: silentLogger,
      allowedOrigins: ["http://localhost:3000"],
      readinessChecks: {
        checkMongo: async () => true,
        checkRedis: async () => true,
      },
    });

    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        status: "ready",
        dependencies: { mongodb: "up", redis: "up" },
      },
    });
  });

  it("GET /ready returns 503 when MongoDB is down", async () => {
    const app = createApp({
      logger: silentLogger,
      allowedOrigins: ["http://localhost:3000"],
      readinessChecks: {
        checkMongo: async () => false,
        checkRedis: async () => true,
      },
    });

    const res = await request(app).get("/ready");
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(res.body.error.details).toEqual([{ mongodb: "down", redis: "up" }]);
  });

  it("GET /ready returns 503 when Redis throws", async () => {
    const app = createApp({
      logger: silentLogger,
      allowedOrigins: ["http://localhost:3000"],
      readinessChecks: {
        checkMongo: async () => true,
        checkRedis: async () => {
          throw new Error("Redis connection refused");
        },
      },
    });

    const res = await request(app).get("/ready");
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(res.body.error.details).toEqual([{ mongodb: "up", redis: "down" }]);
  });
});
