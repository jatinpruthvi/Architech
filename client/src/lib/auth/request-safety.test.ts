import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMutationSafetyBucketsForTests, enforceMutationSafety } from "./request-safety";

afterEach(() => {
  clearMutationSafetyBucketsForTests();
  vi.unstubAllEnvs();
});

describe("mutation request safety", () => {
  it("rejects oversized request bodies", () => {
    const response = enforceMutationSafety(new Request("http://example.com/api/leads", { method: "POST", headers: { "content-length": "300000" } }));
    expect(response?.status).toBe(413);
  });

  it("rejects a cross-origin browser mutation when a site origin is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://architech.example.com");
    const response = enforceMutationSafety(new Request("https://architech.example.com/api/leads", { method: "POST", headers: { origin: "https://evil.example" } }));
    expect(response?.status).toBe(403);
  });

  it("caps repeated mutations from the same client key", () => {
    for (let index = 0; index < 60; index += 1) {
      expect(enforceMutationSafety(new Request("http://example.com/api/leads", { method: "POST", headers: { "x-forwarded-for": "192.0.2.10" } }))).toBeNull();
    }
    const response = enforceMutationSafety(new Request("http://example.com/api/leads", { method: "POST", headers: { "x-forwarded-for": "192.0.2.10" } }));
    expect(response?.status).toBe(429);
  });
});
