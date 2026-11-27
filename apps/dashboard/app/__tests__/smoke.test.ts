import { describe, expect, it } from "vitest";
import { dashboardEnvSchema, parseEnv } from "@resolveai/shared";

describe("dashboard foundation", () => {
  it("parses dashboard environment defaults", () => {
    const env = parseEnv(dashboardEnvSchema, { NODE_ENV: "test" });
    expect(env.NEXT_PUBLIC_API_BASE_URL).toBe("http://localhost:4000");
  });
});
