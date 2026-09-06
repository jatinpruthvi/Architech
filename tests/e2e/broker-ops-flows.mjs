/* End-to-end broker operations: channel request lifecycle, broker lead-inbox
 * replies, and the admin moderation decision path — over real HTTP against
 * the production build.
 *
 * Why this suite exists (2026-09-06 E2E coverage audit): the broker-channel
 * API cluster (~20 endpoints), the broker-side lead workflow, and the admin
 * moderation decision route previously had deep unit/integration coverage but
 * NO end-to-end HTTP journey, even though they carry the money and the
 * moderation decisions. Unit tests prove the domain; only this suite proves
 * the whole HTTP path — auth grants, route handlers, JSON contracts, and the
 * server stores wired together under a production build.
 *
 * Persona note: `broker-admin@example.com` (demo auth source,
 * lib/auth/roles.ts) deliberately carries BOTH the broker grants and the
 * moderation grants (BROKER_ADMIN), so one persona can drive both sides of a
 * draft's journey. There is no second demo organization, so cross-org channel
 * matching stays at the unit level (channel.test.ts) — that boundary is named
 * here rather than papered over with a fabricated org. */
import {
  assert,
  assertEqual,
  assertIncludes,
  createClient,
  createSuite,
  startServer,
} from "./harness.mjs";

const suite = createSuite();
const { group, test } = suite;

const BROKER = { email: "broker-admin@example.com", password: "demo-broker-1234" };
const BUYER = { email: "buyer@example.com", password: "demo-buyer-1234" };

const VALID_REQUIREMENT = {
  intent: "buy",
  role: "buyer",
  citySlug: "ahmedabad",
  localitySlugs: ["paldi"],
  category: "residential",
  subtype: "apartment",
  bhkMin: 3,
  bhkMax: 3,
  budgetMinInr: 10_000_000,
  budgetMaxInr: 12_000_000,
  name: "E2E Channel Buyer",
  phone: "+91 98765 00001",
  consentText: "I consent to Architech contacting me about this requirement.",
};

async function brokerClient(baseUrl) {
  const broker = createClient(baseUrl);
  const signIn = await broker.post("/api/auth/login/", BROKER);
  assertEqual(signIn.status, 200, "demo broker sign-in must succeed");
  return broker;
}

async function run() {
  const server = await startServer({
    env: {
      ARCHITECH_AUTH_SOURCE: "demo",
      ARCHITECH_DEMO_START_SIGNED_OUT: "true",
      /* Same opt-in as marketplace-flows: production refuses demo writes by
         default; these journeys need mutating demo sessions. */
      ARCHITECH_ALLOW_DEMO_AUTH_IN_PRODUCTION: "true",
    },
    label: "broker ops server",
    singleWorker: true,
  });
  const { baseUrl } = server;

  try {
    await group("broker channel journey", async () => {
      await test("anonymous and org-less callers are refused before any work happens", async () => {
        const anonymous = createClient(baseUrl);
        const anon = await anonymous.get("/api/broker/channel/dashboard/");
        assert([401, 403].includes(anon.status), `anonymous dashboard read must be refused, got ${anon.status}`);

        const buyer = createClient(baseUrl);
        await buyer.post("/api/auth/login/", BUYER);
        const denied = await buyer.get("/api/broker/channel/dashboard/");
        assertEqual(denied.status, 403, "an account without a broker organization must be refused");
      });

      await test("requirement → demand request → publish → dashboard → cancel → re-publish refused", async () => {
        const broker = await brokerClient(baseUrl);

        const requirement = await broker.post("/api/broker/channel/requirements/", VALID_REQUIREMENT);
        assertEqual(requirement.status, 201, `a valid requirement must be created (${requirement.status}): ${requirement.text.slice(0, 200)}`);
        const requirementId = JSON.parse(requirement.text).requirement.id;
        assert(requirementId, "the requirement must carry an id");

        const request = await broker.post("/api/broker/channel/requests/", {
          type: "DEMAND",
          sourceRequirementId: requirementId,
          cityId: "ahmedabad",
          intent: "BUY",
          propertyType: "APARTMENT",
          bhkMin: 3,
          bhkMax: 3,
          budgetMinInr: 10_000_000,
          budgetMaxInr: 12_000_000,
        });
        assertEqual(request.status, 201, `a requirement-backed demand must be created (${request.status}): ${request.text.slice(0, 200)}`);
        const created = JSON.parse(request.text).request;
        assertEqual(created.status, "DRAFT", "a new channel request starts as a draft");

        const listed = JSON.parse((await broker.get("/api/broker/channel/requests/")).text);
        assert(listed.requests.some((r) => r.id === created.id), "the request must be listed back to its org");

        const published = await broker.post(`/api/broker/channel/requests/${encodeURIComponent(created.id)}/publish/`, {});
        assertEqual(published.status, 200, `publishing a fresh draft must succeed (${published.status}): ${published.text.slice(0, 200)}`);
        assertEqual(JSON.parse(published.text).request.status, "OPEN", "publishing moves the request to OPEN");

        const dashboard = JSON.parse((await broker.get("/api/broker/channel/dashboard/")).text);
        assertEqual(dashboard.dashboard.openRequests, 1, "the dashboard must count exactly the open request");

        const matches = JSON.parse((await broker.get("/api/broker/channel/matches/")).text);
        assertEqual(matches.ok, true, "the match list endpoint must answer its owner's read");

        const cancelled = await broker.post(`/api/broker/channel/requests/${encodeURIComponent(created.id)}/cancel/`, {});
        assertEqual(cancelled.status, 200, "an org-owned open request can be cancelled");
        assertEqual(JSON.parse(cancelled.text).request.status, "CANCELLED", "the record must record the cancellation");

        const republish = await broker.post(`/api/broker/channel/requests/${encodeURIComponent(created.id)}/publish/`, {});
        assertEqual(republish.status, 409, "a cancelled request can never be silently revived");
      });

      await test("a malformed expiresAt is a 400, never a 500 (BUG-R3-001 regression over HTTP)", async () => {
        const broker = await brokerClient(baseUrl);
        const requirement = await broker.post("/api/broker/channel/requirements/", VALID_REQUIREMENT);
        const requirementId = JSON.parse(requirement.text).requirement.id;
        const response = await broker.post("/api/broker/channel/requests/", {
          type: "DEMAND",
          sourceRequirementId: requirementId,
          cityId: "ahmedabad",
          intent: "BUY",
          propertyType: "APARTMENT",
          bhkMin: 3,
          bhkMax: 3,
          budgetMinInr: 9_000_000,
          budgetMaxInr: 9_500_000,
          expiresAt: "not-a-date",
        });
        assertEqual(response.status, 400, "an unparseable expiresAt must be refused, not crash");
        assertIncludes(response.text, "expiresAt", "the refusal must name the offending field");
      });
    });

    await group("broker leads reply journey", async () => {
      await test("capture → inbox → reply → status advances; every boundary refuses honestly", async () => {
        const marker = `e2e-reply-${Date.now()}`;
        const publicClient = createClient(baseUrl);
        const capture = await publicClient.post("/api/leads/", {
          listingId: "garden-courtyard",
          name: "E2E Reply Journey",
          phone: "+91 98765 00002",
          message: `Reply-journey probe ${marker}`,
          consentText: "I consent to Architech contacting me about this listing.",
        });
        assertEqual(capture.status, 201, "the public lead must be created");

        const anonymous = createClient(baseUrl);
        const anonInbox = await anonymous.get("/api/broker/leads/");
        assert([401, 403].includes(anonInbox.status), `the inbox requires a session, got ${anonInbox.status}`);

        const buyer = createClient(baseUrl);
        await buyer.post("/api/auth/login/", BUYER);
        const buyerReply = await buyer.post("/api/broker/leads/some-id/reply/", { status: "REPLIED" });
        assert([401, 403].includes(buyerReply.status), `an account without lead grants must be refused, got ${buyerReply.status}`);

        const broker = await brokerClient(baseUrl);
        const inbox = JSON.parse((await broker.get("/api/broker/leads/")).text);
        const lead = inbox.leads.find((entry) => (entry.message ?? "").includes(marker));
        assert(lead, "the captured lead must appear in the demo org's inbox (fixture listings attribute to the demo organization)");

        const badStatus = await broker.post(`/api/broker/leads/${encodeURIComponent(lead.id)}/reply/`, { status: "MAYBE" });
        assertEqual(badStatus.status, 400, "an unknown status must be refused client-side, not passed to the domain");

        const reply = await broker.post(`/api/broker/leads/${encodeURIComponent(lead.id)}/reply/`, { status: "REPLIED" });
        assertEqual(reply.status, 200, `an org-owned lead can be advanced (${reply.status}): ${reply.text.slice(0, 200)}`);

        const after = JSON.parse((await broker.get("/api/broker/leads/")).text);
        const advanced = after.leads.find((entry) => entry.id === lead.id);
        assertEqual(advanced?.status, "REPLIED", "the inbox must show the advanced status");
      });
    });

    await group("admin moderation journey", async () => {
      await test("draft → submit → queue → approve → queue drains; the role gate holds", async () => {
        const buyer = createClient(baseUrl);
        await buyer.post("/api/auth/login/", BUYER);
        const denied = await buyer.get("/api/admin/moderation/listings/");
        assertEqual(denied.status, 403, "queue reads are an admin grant, not a signed-in default");

        const broker = await brokerClient(baseUrl);
        const queueBefore = JSON.parse((await broker.get("/api/admin/moderation/listings/")).text);
        assertEqual(queueBefore.ok, true, "the BROKER_ADMIN persona holds the moderation grants");
        assert(Array.isArray(queueBefore.drafts), "the queue answer must be a drafts array");

        const created = await broker.post("/api/broker/listings/", {
          title: "E2E moderation apartment",
          citySlug: "ahmedabad",
          localitySlug: "paldi",
          postalCode: "380007",
          priceInr: 12_200_000,
          bhk: 2,
          areaSqft: 980,
          propertyType: "APARTMENT",
          availability: "READY_TO_MOVE",
          /* The publish gate requires ≥80 description characters, so this is
             intentionally longer prose rather than a stub sentence. */
          description: "An end-to-end moderation journey draft: a two-bedroom apartment in Paldi with cross-ventilation, society parking, and a recently renovated kitchen, described at gate length.",
          reraNumber: "GJ/RERA/AHM/2026/04822-E2E",
          mediaRightsConfirmed: true,
        });
        assertEqual(created.status, 201, `draft creation must succeed (${created.status}): ${created.text.slice(0, 200)}`);
        const draft = JSON.parse(created.text).draft;
        const draftKey = draft.id ?? draft.stableId;

        /* Same gate: at least one photograph, rights-confirmed at creation. */
        const media = await broker.post(`/api/broker/listings/${encodeURIComponent(draftKey)}/media/`, { mediaId: "e2e-photo-001", action: "attach" });
        assertEqual(media.status, 200, `attaching a photograph must succeed (${media.status}): ${media.text.slice(0, 200)}`);
        const inQueue = (queue) =>
          queue.drafts.some((d) => d.id === draftKey || d.stableId === draftKey || (d.title === draft.title && d.postalCode === draft.postalCode));

        const submitted = await broker.post(`/api/broker/listings/${encodeURIComponent(draftKey)}/submit/`, {});
        assertEqual(submitted.status, 200, `submission must move the draft into review (${submitted.status}): ${submitted.text.slice(0, 200)}`);

        const queued = JSON.parse((await broker.get("/api/admin/moderation/listings/")).text);
        assert(inQueue(queued), "the submitted draft must appear in the moderation queue");

        const invalid = await broker.post(`/api/admin/moderation/listings/${encodeURIComponent(draftKey)}/`, { decision: "maybe" });
        assertEqual(invalid.status, 400, "an unknown decision must never reach the domain (the cast guard)");

        const decided = await broker.post(`/api/admin/moderation/listings/${encodeURIComponent(draftKey)}/`, {
          decision: "approve",
          reason: "E2E verified submission.",
        });
        assertEqual(decided.status, 200, `approval must succeed (${decided.status}): ${decided.text.slice(0, 200)}`);

        const after = JSON.parse((await broker.get("/api/admin/moderation/listings/")).text);
        assert(!inQueue(after), "an approved draft must leave the queue");
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
