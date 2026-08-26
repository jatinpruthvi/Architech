/* API contract suite (P1-TEST-001).
   Exercises the built Next.js route handlers directly (the same pattern as the
   existing auth/ai route tests) and asserts stable response shapes and status
   codes. This is a contract test: it locks the public API surface so payload
   changes that would break clients are caught in CI, independent of a live DB
   (memory/fixture sources). */

import { describe, expect, it } from "vitest";
import { GET as searchGet } from "../../../app/api/search/route";
import { GET as suggestGet } from "../../../app/api/search/suggest/route";
import { POST as leadsPost } from "../../../app/api/leads/route";
import { GET as healthGet } from "../../../app/api/observability/health/route";
import { GET as sloGet } from "../../../app/api/observability/slo/route";
import { GET as statusGet } from "../../../app/api/observability/status/route";
import { GET as authorityAssetsGet, POST as authorityAssetsPost } from "../../../app/api/authority/assets/route";
import { POST as authorityOutreachPost } from "../../../app/api/authority/outreach/route";
import { GET as brokerDraftsGet, POST as brokerDraftsPost } from "../../../app/api/broker/listings/route";
import { POST as draftMediaPost } from "../../../app/api/broker/listings/[draftId]/media/route";
import { POST as errorsPost } from "../../../app/api/observability/errors/route";
import { GET as savedSearchesGet, POST as savedSearchesPost } from "../../../app/api/saved-searches/route";
import { GET as reraGet } from "../../../app/api/rera/gujarat/route";
import { GET as aiAssistGet } from "../../../app/api/ai/search-assist/route";
import { GET as listingStatsGet, POST as listingStatsPost } from "../../../app/api/listings/[id]/stats/route";
import { GET as priceTrendsGet } from "../../../app/api/localities/[slug]/price-trends/route";
import { POST as investmentMetricsPost } from "../../../app/api/investment/metrics/route";

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("public API contract", () => {
  it("GET /api/search returns a paginated, source-labelled response", async () => {
    const response = await searchGet(new Request("http://example.com/api/search?q=3%20BHK%20Paldi&filters=3bhk,rera"));
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body).toHaveProperty("source");
    expect(body).toHaveProperty("count");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("results");
    expect(Array.isArray(body.results)).toBe(true);
    expect((body.results as unknown[]).length).toBeLessThanOrEqual((body.page as { pageSize: number }).pageSize);
    expect(response.headers.get("X-Architech-Search-Source")).toBeTruthy();
  });

  it("GET /api/search/suggest returns a capped suggestion list", async () => {
    const response = await suggestGet(new Request("http://example.com/api/search/suggest?q=pal"));
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect((body.suggestions as unknown[]).length).toBeGreaterThan(0);
  });

  it("POST /api/leads returns a masked lead contract", async () => {
    const response = await leadsPost(new Request("http://example.com/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingId: "garden-courtyard", name: "Kinjal Shah", phone: "+91 98765 43210", message: "I would like to visit this home.", consentText: "I consent to masked contact for this enquiry.", idempotencyKey: "api-contract-1" }),
    }));
    expect(response.status).toBe(201);
    const body = await json(response);
    expect(body.ok).toBe(true);
    expect((body as { lead: { phoneMasked: string } }).lead.phoneMasked).toContain("3210");
    expect(response.headers.get("X-Architech-Lead-Mode")).toBe("MASKED");
  });

  it("Get /api/observability/health reports service health", async () => {
    const response = await healthGet();
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("architech-web");
  });

  it("GET /api/observability/slo returns SLO status and results", async () => {
    const response = await sloGet();
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.status).toBe("ok");
    expect(Array.isArray(body.results)).toBe(true);
  });

  it("POST /api/observability/errors validates a redacted error report", async () => {
    const valid = await errorsPost(new Request("http://example.com/api/observability/errors", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "client error", severity: "error", route: "/paldi/" }) }));
    expect(valid.status).toBe(200);
    expect((await json(valid)).ok).toBe(true);

    const invalid = await errorsPost(new Request("http://example.com/api/observability/errors", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) }));
    expect(invalid.status).toBe(400);
  });

  it("GET/POST /api/saved-searches create and list saved searches", async () => {
    const created = await savedSearchesPost(new Request("http://example.com/api/saved-searches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "3 BHK Paldi", filters: ["3bhk"], notify: true }) }));
    expect(created.status).toBe(201);
    const body = await json(created);
    expect(body.ok).toBe(true);
    expect((body as { savedSearch: { notify: boolean } }).savedSearch.notify).toBe(true);

    const list = await savedSearchesGet();
    expect(list.status).toBe(200);
    const listBody = await json(list);
    expect((listBody as { savedSearches: unknown[] }).savedSearches.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/rera/gujarat validates input and returns provenance", async () => {
    const response = await reraGet(new Request("http://example.com/api/rera/gujarat?registration=GJ/RERA/AHM/2026/04821-DEMO"));
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.ok).toBe(true);
    expect((body as { provider: string }).provider).toBe("demo-rera-adapter");
  });

  it("POST/GET /api/listings/:id/stats record and read idempotent metrics", async () => {
    const post = await listingStatsPost(new Request("http://example.com/api/listings/garden-courtyard/stats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ metric: "views", sessionKey: "api-contract-session" }),
    }), { params: Promise.resolve({ id: "garden-courtyard" }) });
    expect([200, 201]).toContain(post.status);
    const body = await json(post);
    expect((body as { stats: { views: number } }).stats.views).toBe(1);

    const invalid = await listingStatsPost(new Request("http://example.com/api/listings/garden-courtyard/stats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ metric: "nope" }),
    }), { params: Promise.resolve({ id: "garden-courtyard" }) });
    expect(invalid.status).toBe(400);

    const get = await listingStatsGet(new Request("http://example.com/api/listings/garden-courtyard/stats"), { params: Promise.resolve({ id: "garden-courtyard" }) });
    const getBody = await json(get);
    expect((getBody as { stats: { listingId: string } }).stats.listingId).toBe("garden-courtyard");
  });

  it("GET /api/observability/status returns consolidated service status", async () => {
    const response = await statusGet();
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("architech-web");
    expect((body as { slo: { status: string; results: unknown[] } }).slo.status).toBe("ok");
    expect((body as { endpoints: { health: string } }).endpoints.health).toBe("/api/observability/health");
  });

  it("GET /api/broker/listings rejects an anonymous request", async () => {
    const response = await brokerDraftsGet(new Request("http://example.com/api/broker/listings?mode=none"));
    expect(response.status).toBe(401);
  });

  it("GET /api/broker/listings returns the broker's drafts", async () => {
    const response = await brokerDraftsGet();
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.ok).toBe(true);
    expect(Array.isArray((body as { drafts: unknown[] }).drafts)).toBe(true);
  });

  it("DELETE /api/broker/leads with consent mode revokes a lead", async () => {
    const created = await leadsPost(new Request("http://example.com/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingId: "garden-courtyard", name: "Sanjay Patel", phone: "+91 91234 56780", message: "Please share more details about this home.", consentText: "I consent to masked contact.", idempotencyKey: "api-contract-delete" }),
    }));
    const { lead } = await json(created) as { lead: { id: string } };
    const response = await (await import("../../../app/api/broker/leads/[id]/route")).DELETE(new Request(`http://example.com/api/broker/leads/${encodeURIComponent(lead.id)}?mode=consent`, { method: "DELETE" }), { params: Promise.resolve({ id: lead.id }) });
    expect(response.status).toBe(200);
    const body = await json(response);
    expect((body as { lead: { status: string } }).lead.status).toBe("DELETED");
  });

  it("POST /api/broker/listings/:id/media attaches media ids", async () => {
    const created = await brokerDraftsPost(new Request("http://example.com/api/broker/listings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Media attach draft", localitySlug: "paldi", priceInr: 15000000, bhk: 3, areaSqft: 1500, propertyType: "APARTMENT", availability: "READY_TO_MOVE", description: "A draft used to test media attachment through the API contract.", mediaRightsConfirmed: true }),
    }));
    const { draft } = await json(created) as { draft: { id: string } };
    const response = await draftMediaPost(new Request("http://example.com/api/broker/listings/medium/media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaId: "media_demo_1" }) }), { params: Promise.resolve({ draftId: draft.id }) });
    expect(response.status).toBe(200);
    const body = await json(response);
    expect((body as { ok: boolean }).ok).toBe(true);
  });

  it("GET/POST /api/authority/assets enforce the disclosure registry", async () => {
    const created = await authorityAssetsPost(new Request("http://example.com/api/authority/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "guide", title: "How we verify against Gujarat RERA", isNofollow: true, paidForLink: false, disclosure: "declared" }),
    }));
    expect([200, 201]).toContain(created.status);

    const list = await authorityAssetsGet();
    const body = await json(list);
    expect(Array.isArray((body as { assets: unknown[] }).assets)).toBe(true);
  });

  it("POST /api/authority/outreach requires a reviewer for accepted outreach", async () => {
    const rejected = await authorityOutreachPost(new Request("http://example.com/api/authority/outreach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-08-25", target: "example.com", outcome: "accepted", reviewedBy: "" }),
    }));
    expect(rejected.status).toBe(400);
  });


  it("GET /api/localities/:slug/price-trends returns a derived price summary", async () => {
    const response = await priceTrendsGet(new Request("http://example.com/api/localities/paldi/price-trends"), { params: Promise.resolve({ slug: "paldi" }) });
    expect(response.status).toBe(200);
    const body = await json(response);
    expect((body as { summary: { count: number } }).summary.count).toBeGreaterThan(0);
    expect((body as { summary: { medianPriceInr: number | null } }).summary.medianPriceInr).toBeGreaterThan(0);
  });

  it("POST /api/investment/metrics validates and computes investment metrics", async () => {
    const ok = await investmentMetricsPost(new Request("http://example.com/api/investment/metrics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ priceInr: 60000000, annualRentInr: 3600000, annualExpensesInr: 400000, downPaymentInr: 15000000 }) }));
    expect(ok.status).toBe(200);
    const body = await json(ok);
    expect((body as { metrics: { capRatePct: number } }).metrics.capRatePct).toBeCloseTo(5.33, 1);

    const invalid = await investmentMetricsPost(new Request("http://example.com/api/investment/metrics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ priceInr: -1 }) }));
    expect(invalid.status).toBe(400);
  });

  it("GET /api/ai/search-assist returns deterministic structured intent", async () => {
    const response = await aiAssistGet(new Request("http://example.com/api/ai/search-assist?q=Paldi%203%20BHK"));
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.source).toBe("deterministic-ai-safe");
    expect((body as { structured: { localitySlug: string } }).structured.localitySlug).toBe("paldi");
  });
});
