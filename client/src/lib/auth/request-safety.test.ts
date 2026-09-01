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

  it("accepts a same-origin browser mutation from the configured site origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://architech.example.com");
    const response = enforceMutationSafety(new Request("https://architech.example.com/api/leads", { method: "POST", headers: { origin: "https://architech.example.com" } }));
    expect(response).toBeNull();
  });

  it("accepts a browser mutation whose Origin matches the serving host (local dev / preview)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://architech.example.com");
    // Local dev: the page is served from localhost:3000, not the configured domain.
    expect(enforceMutationSafety(new Request("http://localhost:3000/api/leads", { method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000" } }))).toBeNull();
    // A preview/staging host behind a proxy that forwards host and proto.
    expect(enforceMutationSafety(new Request("https://architech.example.com/api/leads", { method: "POST", headers: { origin: "https://pr-12.preview.example", "x-forwarded-host": "pr-12.preview.example", "x-forwarded-proto": "https" } }))).toBeNull();
  });

  it("rejects a malformed Origin header rather than failing open", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://architech.example.com");
    const response = enforceMutationSafety(new Request("https://architech.example.com/api/leads", { method: "POST", headers: { origin: "not a url" } }));
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
