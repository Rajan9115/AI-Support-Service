import { describe, expect, it } from "vitest";
import { apiEnvSchema, ERROR_CODES, parseEnv } from "../index.js";

describe("shared foundation", () => {
  it("validates valid api environment configuration", () => {
    const parsed = parseEnv(apiEnvSchema, {
      NODE_ENV: "test",
      PORT: "4000",
      MONGODB_URI: "mongodb://localhost:27017/resolveai_test",
      REDIS_URL: "redis://localhost:6379",
      SESSION_SECRET: "a-very-long-test-session-secret-32-chars",
    });

    expect(parsed.PORT).toBe(4000);
    expect(parsed.NODE_ENV).toBe("test");
  });

  it("throws a descriptive error when required environment variables are missing", () => {
    expect(() => parseEnv(apiEnvSchema, {})).toThrowError(/Invalid environment configuration/);
  });

  it("exports standard error codes", () => {
    expect(ERROR_CODES.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(ERROR_CODES.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
  });
});
