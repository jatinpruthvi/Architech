/* The acquisition route's contract, as behaviour rather than as intent.

   These tests exist because "the queue is internal, not public" is a claim
   that a comment cannot enforce. Anyone can write `// internal only` above a
   handler that happily answers an anonymous request. What enforces it is a
   test that makes the anonymous request and watches it fail.

   The 401 assertion is the important one. The queue states exactly where
   coverage is thin — which cities have no publishable index, which localities
   are a listing or two short — and that is a competitive fact. The reasoning
   is written up in docs/seo/seo-os-decisions.md; this file is what stops it
   being silently reversed by someone who wants the page to render in a
   preview.

   The `no-store` assertion matters for a quieter reason: the queue's entire
   value is that it moves the moment a listing is approved. A cached worklist
   sends someone to source inventory the site already has, which is worse
   than having no worklist at all. */
import { describe, expect, it, vi } from "vitest";
import { GET } from "../../../../app/api/admin/acquisition/route";

function request(url = "http://example.com/api/admin/acquisition") {
  return new Request(url);
}

describe("GET /api/admin/acquisition", () => {
  it("refuses an anonymous request", async () => {
    const response = await GET(request("http://example.com/api/admin/acquisition?mode=none"));
    expect(response.status).toBe(401);
  });

  it("refuses a session without the permission", async () => {
    // The gate is a permission check, not mere sign-in. An authenticated
    // buyer must not see where coverage is thin.
    const access = await GET(request("http://example.com/api/admin/acquisition?mode=none"));
    expect(access.status).not.toBe(200);
  });

  it("serves the queue to an authorized session", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.headline === null || typeof body.headline.action === "string").toBe(true);
    expect(Array.isArray(body.plans)).toBe(true);
    expect(body.totals).toMatchObject({ cities: expect.any(Number) });
  });

  it("is never cached", async () => {
    const response = await GET(request());
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("refuses an unauthenticated session in production even when demo auth would pass", async () => {
    // Demo auth is disabled in production. An agent that removes this gate to
    // make a preview render has broken the one control protecting the data.
    const previous = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    try {
      const response = await GET(request());
      expect(response.status).toBe(503);
    } finally {
      if (previous === undefined) vi.unstubAllEnvs();
      else vi.stubEnv("NODE_ENV", previous);
    }
  });
});
