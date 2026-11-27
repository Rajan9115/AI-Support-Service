import { describe, expect, it } from "vitest";
import { API_SERVICE_NAME, getApiFoundationInfo } from "../index.js";

describe("api foundation", () => {
  it("exposes service metadata", () => {
    const info = getApiFoundationInfo();
    expect(info.service).toBe(API_SERVICE_NAME);
    expect(info.defaultErrorCode).toBe("INTERNAL_ERROR");
  });
});
