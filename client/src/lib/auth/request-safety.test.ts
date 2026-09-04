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

  it("accepts a sandbox preview origin outside production", () => {
    /* The e2b/manus proxies rewrite Host to localhost:3000 but leave Origin as
       the public preview hostname and send no x-forwarded-host, so host
       equality cannot hold and every mutation 403d. */
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://architech.example.com");
    const request = new Request("http://localhost:3000/api/requirements/", {
      method: "POST",
      headers: { origin: "https://3000-abc123.e2b.app", host: "localhost:3000" },
    });
    expect(enforceMutationSafety(request)).toBeNull();
  });

  it("still rejects that same preview origin in production", () => {
    // The exception is a dev affordance, not a hole in the deployed site.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://architech.example.com");
    const request = new Request("https://architech.example.com/api/requirements/", {
      method: "POST",
      headers: { origin: "https://3000-abc123.e2b.app", host: "architech.example.com" },
    });
    expect(enforceMutationSafety(request)?.status).toBe(403);
  });

  it("matches the preview host as a suffix, not a substring", () => {
    /* `https://evil.example/?x=.e2b.app` and `https://note2b.app.evil.example`
       both contain the wildcard text; only a real subdomain may pass. */
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://architech.example.com");
    for (const origin of [
      "https://evil.example/?x=.e2b.app",
      "https://note2b.app.evil.example",
      "https://e2b.app.evil.example",
      "http://3000-abc.e2b.app",
    ]) {
      const request = new Request("http://localhost:3000/api/requirements/", {
        method: "POST",
        headers: { origin, host: "localhost:3000" },
      });
      expect(enforceMutationSafety(request)?.status, origin).toBe(403);
    }
  });

  it("rejects a malformed Origin header rather than failing open", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://architech.example.com");
    const response = enforceMutationSafety(new Request("https://architech.example.com/api/leads", { method: "POST", headers: { origin: "not a url" } }));
    expect(response?.status).toBe(403);
  });

  it("still checks Origin when no site URL is configured", () => {
    /* Regression: the whole Origin arm used to be gated on
       NEXT_PUBLIC_SITE_URL, so the CSRF defence vanished in local dev and in
       any deployment that had not set it — exactly the configurations where a
       credential endpoint is most likely to be probed. Host equality alone is
       a complete check and needs no configuration. */
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const hostile = enforceMutationSafety(new Request("http://localhost:3000/api/auth/login/", { method: "POST", headers: { origin: "https://evil.example", host: "localhost:3000" } }));
    expect(hostile?.status).toBe(403);
    const friendly = enforceMutationSafety(new Request("http://localhost:3000/api/auth/login/", { method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000" } }));
    expect(friendly).toBeNull();
  });

  it("caps repeated mutations from the same client key", () => {
    for (let index = 0; index < 60; index += 1) {
      expect(enforceMutationSafety(new Request("http://example.com/api/leads", { method: "POST", headers: { "x-forwarded-for": "192.0.2.10" } }))).toBeNull();
    }
    const response = enforceMutationSafety(new Request("http://example.com/api/leads", { method: "POST", headers: { "x-forwarded-for": "192.0.2.10" } }));
    expect(response?.status).toBe(429);
  });
});
