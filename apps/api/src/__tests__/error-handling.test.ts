import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createLogger } from "../infrastructure/logger/logger.js";

const silentLogger = createLogger("silent");

function buildTestApp(rateLimitMax: number = 120) {
  return createApp({
    logger: silentLogger,
    allowedOrigins: ["http://localhost:3000"],
    readinessChecks: {
      checkMongo: async () => true,
      checkRedis: async () => true,
    },
    rateLimitMax,
  });
}

describe("error handling, request correlation, CORS, and rate limiting", () => {
  it("returns stable 404 envelope for unknown routes", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/v1/nonexistent").set("X-Request-Id", "req-custom-1234");

    expect(res.status).toBe(404);
    expect(res.headers["x-request-id"]).toBe("req-custom-1234");
    expect(res.body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
        requestId: "req-custom-1234",
      },
    });
  });

  it("returns 400 VALIDATION_ERROR on malformed JSON body", async () => {
    const app = buildTestApp();
    const res = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send("{invalid-json");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe("Malformed JSON request body.");
  });

  it("rejects disallowed CORS origins with 403 FORBIDDEN", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/health").set("Origin", "https://evil.example.com");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("enforces rate limits with 429 RATE_LIMITED", async () => {
    const app = buildTestApp(2);

    const r1 = await request(app).get("/health");
    const r2 = await request(app).get("/health");
    const r3 = await request(app).get("/health");

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect(r3.body.success).toBe(false);
    expect(r3.body.error.code).toBe("RATE_LIMITED");
  });
});
