import { describe, expect, it } from "vitest";
import { getAllowedDashboardOrigins, loadApiEnv } from "../config/env.js";

describe("api config validation", () => {
  it("fails fast when required config is missing", () => {
    expect(() => loadApiEnv({})).toThrowError(/Invalid environment configuration/);
  });

  it("filters out wildcard origins and trims whitespace", () => {
    const origins = getAllowedDashboardOrigins({
      ALLOWED_DASHBOARD_ORIGINS: " http://localhost:3000 , * , https://app.resolveai.io ",
    });
    expect(origins).toEqual(["http://localhost:3000", "https://app.resolveai.io"]);
  });
});
