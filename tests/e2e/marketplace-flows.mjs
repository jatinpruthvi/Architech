#!/usr/bin/env node
/* Marketplace end-to-end journeys over real HTTP (P1-TEST-001).
 *
 * Where `public-journeys.mjs` proves the anonymous surface renders and
 * `auth-flows.mjs` proves session lifecycle, this suite proves the money
 * paths end-to-end against a REAL production server:
 *
 *   · lead capture — validation, consent, masking, idempotent replay,
 *     audit headers
 *   · saved searches — create/list/dedupe/delete, ownership scoping,
 *     the delete-again 404 semantics that regresses to idempotent-200
 *     if anyone "tidies" it
 *   · broker workflow — draft creation validation, ownership, submission
 *   · suggest — the same engine the command palette talks to, exercised
 *     over HTTP with Hindi input and PIN codes
 *   · observability — web-vitals ingest + the SLO endpoint flipping from
 *     bootstrapped to observed as traffic arrives
 *
 * Demo auth mode with a single worker: draft/lead stores are in-process,
 * so the worker count is pinned (see harness note at startServer).
 */
import {
  assert,
  assertEqual,
  assertIncludes,
  assertMatch,
  assertNotIncludes,
  createClient,
  createSuite,
  startServer,
} from "./harness.mjs";

const suite = createSuite();
const { group, test } = suite;

const BROKER = { email: "broker-admin@example.com", password: "demo-broker-1234" };
const BUYER = { email: "buyer@example.com", password: "demo-buyer-1234" };

const VALID_LEAD = (overrides = {}) => ({
  listingId: "garden-courtyard",
  name: "E2E Buyer",
  phone: "+91 98765 43210",
  message: "Please call me back about this property.",
  consentText: "I consent to Architech contacting me about this listing.",
  ...overrides,
});

async function run() {
  const server = await startServer({
    env: {
      ARCHITECH_AUTH_SOURCE: "demo",
      ARCHITECH_DEMO_START_SIGNED_OUT: "true",
      /* These journeys need demo sessions that can actually MUTATE against a
         production build. Production refuses demo writes by default
         (DEMO_AUTH_DISABLED, asserted in auth-flows); the explicit opt-in is
         what makes broker/saved-search journeys testable end-to-end. */
      ARCHITECH_ALLOW_DEMO_AUTH_IN_PRODUCTION: "true",
    },
    label: "marketplace server",
    singleWorker: true,
  });
  const { client, baseUrl } = server;

  try {
    await group("lead capture journey", async () => {
      await test("a lead without consent text is refused with a 400", async () => {
        const response = await client.post("/api/leads/", VALID_LEAD({ consentText: "" }));
        assertEqual(response.status, 400, "consent-less leads must be refused");
        const body = JSON.parse(response.text);
        assertEqual(body.ok, false, "refusal must be marked ok:false");
        assert(body.errors.some((e) => /consent/i.test(e)), "the reason must name consent");
      });

      await test("a valid lead is created with a masked phone and an audit header", async () => {
        const response = await client.post("/api/leads/", VALID_LEAD({ idempotencyKey: "e2e-lead-gap-test" }));
        assertEqual(response.status, 201, "a valid lead must be created");
        const body = JSON.parse(response.text);
        assertEqual(body.ok, true, "lead creation must succeed");
        /* Masking contract: `•••• ••• 3210` shape — bullets present, and no
           run of more than 4 of the caller's digits survives anywhere in the
           response (the default idempotency key would embed them, which is
           why this test supplies its own key). */
        assertMatch(body.lead.phoneMasked, /•{3,}/, "the API must return a bullet-masked phone");
        assertNotIncludes(body.lead.phoneMasked, "98765", "the masked phone must not contain the caller's routing digits");
        assertNotIncludes(JSON.stringify(body), "+91 98765", "the payload must never echo the caller's raw phone");
        assert(response.headers.get("x-architech-audit-event"), "every lead must carry an audit-event header (Akshaya Patra)");
        assertEqual(response.headers.get("x-architech-lead-mode"), "MASKED", "default lead mode keeps the phone masked until consent upgrades it");
      });

      await test("replaying the same idempotency key returns the original, not a duplicate", async () => {
        /* Double-tap and unreliable networks make duplicate leads a certainty,
           so the server dedupes on the idempotency key rather than trusting the
           client to send once. The replay is signalled by status 200 +
           `duplicate: true`, while the lead's privacy mode stays MASKED. */
        const response = await client.post("/api/leads/", VALID_LEAD({ idempotencyKey: "e2e-lead-gap-test" }));
        assertEqual(response.status, 200, "a replay must be 200, not 201");
        const body = JSON.parse(response.text);
        assertEqual(body.duplicate, true, "the replay must be marked as a duplicate");
        const replayed = body.lead;
        assertMatch(replayed.phoneMasked, /•{3,}/, "the replayed record stays masked");
      });

      await test("a lead for a listing that does not exist is a 4xx, not a server error", async () => {
        const response = await client.post("/api/leads/", VALID_LEAD({ listingId: "ghost", idempotencyKey: "e2e-lead-ghost" }));
        assert(response.status >= 400 && response.status < 500, `unknown-listing lead must be a 4xx, got ${response.status}`);
      });
    });

    await group("saved search journey", async () => {
      await test("reading saved searches without a session is refused", async () => {
        const anonymous = createClient(baseUrl);
        const response = await anonymous.get("/api/saved-searches/");
        assert([401, 403].includes(response.status), `saved searches without auth must be refused, got ${response.status}`);
      });

      await test("create → list → dedupe → delete → delete-again walkthrough", async () => {
        const buyer = createClient(baseUrl);
        const signIn = await buyer.post("/api/auth/login/", BUYER);
        assertEqual(signIn.status, 200, "demo buyer sign-in must succeed");

        const created = await buyer.post("/api/saved-searches/", { query: "3 BHK in Paldi", filters: ["bhk:3"], idempotencyKey: "noop" });
        assertEqual(created.status, 201, "first save must be a 201");
        const savedId = JSON.parse(created.text).savedSearch.id;
        assert(savedId, "the created saved search must include an id");

        const list = await buyer.get("/api/saved-searches/");
        assertEqual(JSON.parse(list.text).count >= 1, true, "the saved search must be listed back");

        const again = await buyer.post("/api/saved-searches/", { query: "3 BHK in Paldi", filters: ["bhk:3"] });
        assertEqual(again.status, 200, "an identical save must dedupe to 200");

        const deleted = await buyer.delete(`/api/saved-searches/${encodeURIComponent(savedId)}/`);
        assertEqual(deleted.status, 200, "deleting an owned saved search must succeed");

        const deletedAgain = await buyer.delete(`/api/saved-searches/${encodeURIComponent(savedId)}/`);
        assertEqual(deletedAgain.status, 404, "deleting twice must be a 404 (not idempotent-200, not a 500)");
      });

      await test("one buyer cannot see or delete another account's saved search", async () => {
        /* Saved searches carry intent AND budget — cross-account visibility
           would be a privacy breach between consumers and a commercial one
           between competing brokers. */
        const broker = createClient(baseUrl);
        await broker.post("/api/auth/login/", BROKER);
        const created = await broker.post("/api/saved-searches/", { query: "broker watchlist", filters: [] });
        assertEqual(created.status, 201, "broker save must succeed");
        const savedId = JSON.parse(created.text).savedSearch.id;

        const buyer = createClient(baseUrl);
        await buyer.post("/api/auth/login/", BUYER);
        const foreignRead = await buyer.delete(`/api/saved-searches/${encodeURIComponent(savedId)}/`);
        assertEqual(foreignRead.status, 404, "another account's id must look exactly like a non-existent id");

        const buyerList = JSON.parse((await buyer.get("/api/saved-searches/")).text).savedSearches;
        assert(!buyerList.some((s) => s.id === savedId), "the broker's saved search must not appear in the buyer's list");
      });
    });

    await group("broker draft workflow journey", async () => {
      await test("draft creation requires auth", async () => {
        const anonymous = createClient(baseUrl);
        const response = await anonymous.post("/api/broker/listings/", { title: "ghost" });
        assert([401, 403].includes(response.status), `unauthenticated draft creation must be refused, got ${response.status}`);
      });

      await test("an invalid draft is refused with field-level errors, a valid one is created and listed", async () => {
        const broker = createClient(baseUrl);
        await broker.post("/api/auth/login/", BROKER);

        const invalid = await broker.post("/api/broker/listings/", { title: "x", citySlug: "nowhere" });
        assertEqual(invalid.status, 400, "an invalid draft must be refused");
        const invalidBody = JSON.parse(invalid.text);
        assert(invalidBody.errors.length >= 3, "a nearly-empty draft must surface several field errors");

        const valid = await broker.post("/api/broker/listings/", {
          title: "E2E garden apartment",
          citySlug: "ahmedabad",
          localitySlug: "paldi",
          postalCode: "380007",
          priceInr: 18500000,
          bhk: 3,
          areaSqft: 1482,
          propertyType: "APARTMENT",
          availability: "READY_TO_MOVE",
          description: "An end-to-end test draft with enough description for moderation review.",
          reraNumber: "GJ/RERA/AHM/2026/04821-DEMO",
          mediaRightsConfirmed: true,
        });
        assertEqual(valid.status, 201, "a valid draft must be created");
        const created = JSON.parse(valid.text).draft;
        const draftKey = created.id ?? created.stableId;
        assert(draftKey, "the created draft must carry an identifier");

        const list = await broker.get("/api/broker/listings/");
        const drafts = JSON.parse(list.text).drafts ?? [];
        assert(
          drafts.some((d) => d.id === draftKey || d.stableId === draftKey || (d.title === created.title && d.postalCode === "380007")),
          "the created draft must be listed back to its owner",
        );
      });

      await test("a buyer cannot create broker drafts (role gate)", async () => {
        const buyer = createClient(baseUrl);
        await buyer.post("/api/auth/login/", BUYER);
        const response = await buyer.post("/api/broker/listings/", { title: "sneak" });
        assertEqual(response.status, 403, "an account without the draft permission must be refused");
      });
    });

    await group("suggest journey (the palette's engine over HTTP)", async () => {
      await test("empty query returns non-empty popular suggestions", async () => {
        const response = await client.get("/api/search/suggest/");
        assertEqual(response.status, 200, "bare suggest must respond");
        const body = JSON.parse(response.text);
        assert(body.count >= 4, "popular suggestions must seed the empty state (got " + body.count + ")");
      });

      await test("a locality query returns a navigable locality suggestion", async () => {
        const response = await client.get("/api/search/suggest/?q=paldi&city=ahmedabad");
        const body = JSON.parse(response.text);
        const locality = body.suggestions.find((s) => s.kind === "locality");
        assert(locality, "a locality hit must be suggested");
        assertMatch(locality.href ?? "", /^\/buy\/ahmedabad\/paldi\/$/, "the suggestion must carry a navigable href");
      });

      await test("a PIN code resolves to the locality it belongs to", async () => {
        const response = await client.get("/api/search/suggest/?q=380007");
        const body = JSON.parse(response.text);
        assert(body.suggestions.some((s) => s.kind === "locality" || s.kind === "pincode"), "a known PIN must resolve to its place");
      });

      await test("a hostile suggestion query stays inert data, echoed only by the free-text entry", async () => {
        const response = await client.get("/api/search/suggest/?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E");
        assertEqual(response.status, 200, "hostile input must still be a normal response");
        const body = JSON.parse(response.text);
        /* The suggest payload is DATA for React to render as text (escaped).
           The only entry allowed to reflect the caller's bytes is the
           intentional free-text fallback (kind "query" — "Search for exactly
           this"); every registry-derived suggestion must be built from the
           corpus and must never smuggle the caller's markup through. */
        for (const suggestion of body.suggestions) {
          if (suggestion.kind === "query") continue;
          assert(!/<[a-z]+/i.test(suggestion.label + (suggestion.description ?? "") + (suggestion.hint ?? "")),
            `registry suggestions must never reflect caller markup: ${suggestion.label}`);
        }
        const raw = body.suggestions.find((s) => s.kind === "query");
        assert(raw && raw.label.includes("<img"), "the free-text fallback must echo the query verbatim (React text-escapes it)");
      });
    });

    await group("observability journey", async () => {
      await test("the capture endpoint accepts a real web-vital and the SLO endpoint reports", async () => {
        await client.get("/api/search/?q=paldi&city=ahmedabad"); // api latency observations are recorded on the search API itself
        const report = await client.post("/api/observability/web-vitals/", {
          name: "LCP",
          value: 1450,
          rating: "good",
          route: "/",
        });
        assertEqual(report.status, 200, "a valid metric must be accepted");
        assertEqual(JSON.parse(report.text).ok, true, "the capture route must confirm");

        const slo = await client.get("/api/observability/slo/");
        assertEqual(slo.status, 200, "the SLO endpoint must respond");
        const results = JSON.parse(slo.text).results;
        const apiLatency = results.find((r) => r.id === "api_p95_latency");
        assert(apiLatency, "the search-API latency SLO must be reported");
        assertEqual(apiLatency.basis, "observed", "after real traffic the API SLO must be observed, not bootstrapped");
        assert(apiLatency.sampleSize >= 1, "the observation must carry a sample size");
        const lcp = results.find((r) => r.id === "lcp_p75");
        assert(lcp && lcp.basis === "observed" && lcp.sampleSize >= 1, "the LCP SLO must flip to observed after a real RUM sample");
      });

      await test("garbage metrics are refused, never ingested", async () => {
        const response = await client.post("/api/observability/web-vitals/", { metricName: "INP", value: "fast" });
        assertEqual(response.status, 400, "a malformed metric must be refused");
      });
    });
  } finally {
    if (suite.results.failed > 0) {
      const log = server.getOutput().split("\n").filter((line) => /error/i.test(line)).slice(-8).join("\n");
      if (log) console.log(`\n\x1b[33mserver log (errors):\x1b[0m\n${log}`);
    }
    server.stop();
  }
}

await run();
if (!suite.summary()) process.exitCode = 1;
