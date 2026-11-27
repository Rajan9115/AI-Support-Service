import { describe, expect, it } from "vitest";
import { API_SERVICE_NAME, createApp } from "../index.js";

describe("api foundation", () => {
  it("exports service name and createApp", () => {
    expect(API_SERVICE_NAME).toBe("resolveai-api");
    expect(typeof createApp).toBe("function");
  });
});
