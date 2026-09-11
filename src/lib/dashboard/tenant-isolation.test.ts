/* Multi-tenant isolation for every dashboard panel, at the ROUTE level.
 *
 * The first dashboard pass tested that each role's dashboard rendered and
 * that requirements were isolated. That was not enough: two panels
 * (saved searches, lead inbox) rendered perfectly while returning every
 * account's data, because rendering proves the wiring exists and says nothing
 * about the `where` clause behind it.
 *
 * The rule this file enforces: every panel that reads per-person or
 * per-organization data must be exercised with TWO accounts, and account B
 * must never see account A's rows. A single-account test passes just as
 * happily against a global store, which is exactly how the leaks survived.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getRequirements, POST as postRequirement } from "../../../../app/api/requirements/route";
import { GET as getSavedSearches, POST as postSavedSearch } from "../../../../app/api/saved-searches/route";
import { DELETE as deleteSavedSearch } from "../../../../app/api/saved-searches/[id]/route";
import { GET as getLeads } from "../../../../app/api/broker/leads/route";
import { DELETE as deleteLead } from "../../../../app/api/broker/leads/[id]/route";
import { POST as replyToLead } from "../../../../app/api/broker/leads/[id]/reply/route";
import { resetRequirementStoreForTests } from "@/lib/requirements";
import { resetSavedSearchStoreForTests } from "@/lib/saved-search/saved-search";
import { createLead, resetLeadStoreForTests } from "@/lib/leads/lead";
import { permissionsForRole, type AuthSession } from "@/lib/auth/roles";

const currentSession = vi.hoisted(() => ({ value: null as AuthSession | null }));

vi.mock("@/lib/auth/live", () => ({
  getSessionContractForRequest: async () => ({
    session: currentSession.value,
    source: currentSession.value ? "better-auth-contract-demo" : "better-auth-signed-out",
    missing: [],
  }),
}));

const ORG_A = { id: "org-a", slug: "a", name: "Alpha Realty", verificationStatus: "VERIFIED_PARTNER" } as const;
const ORG_B = { id: "org-b", slug: "b", name: "Beta Estates", verificationStatus: "VERIFIED_PARTNER" } as const;

function signIn(userId: string, organization?: AuthSession["organization"]) {
  const role = organization ? "BROKER_ADMIN" : "BUYER";
  currentSession.value = {
    user: { id: userId, name: userId, email: `${userId}@example.com`, role },
    organization,
    permissions: permissionsForRole(role),
    source: "better-auth-contract-demo",
  };
}

/* Read-only inbox watcher (e.g. a reporting tooling account): holds the read
   grant and an org, but NOT lead.inbox.write. */
function signInReadOnly(userId: string, organization: AuthSession["organization"]) {
  currentSession.value = {
    user: { id: userId, name: userId, email: `${userId}@example.com`, role: "BROKER_MEMBER" },
    organization,
    permissions: permissionsForRole("BROKER_MEMBER").filter((p) => !p.startsWith("lead.inbox.write")),
    source: "better-auth-contract-demo",
  };
}

const req = (url: string, init?: RequestInit) => new Request(`http://localhost:3000${url}`, init);
const jsonPost = (url: string, body: unknown) =>
  req(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const body = async (response: Response) => (await response.json()) as Record<string, unknown>;

beforeEach(() => {
  resetRequirementStoreForTests();
  resetSavedSearchStoreForTests();
  resetLeadStoreForTests();
  currentSession.value = null;
});

describe("requirements panel is isolated per account", () => {
  const brief = (name: string, phone: string) => ({
    intent: "buy", citySlug: "mumbai", category: "residential", subtype: "Flat/Apartment",
    localitySlugs: ["powai"], role: "buyer", name, phone,
    consentText: "I agree to be contacted about this requirement.",
  });

  it("shows account B nothing that account A filed", async () => {
    signIn("alice");
    expect((await postRequirement(jsonPost("/api/requirements/", brief("Alice", "9811111111")))).status).toBe(201);

    signIn("bob");
    const bob = await body(await getRequirements(req("/api/requirements/")));
    expect(bob.requirements).toEqual([]);

    signIn("alice");
    expect((await body(await getRequirements(req("/api/requirements/")))).count).toBe(1);
  });
});

describe("saved searches panel is isolated per account", () => {
  it("shows account B nothing that account A saved", async () => {
    signIn("alice");
    const created = await postSavedSearch(jsonPost("/api/saved-searches/", { query: "3 BHK Powai under 2.4Cr", notify: true }));
    expect(created.status).toBe(201);
    const aliceRow = (await body(created)).savedSearch as { id: string };

    signIn("bob");
    const bob = await body(await getSavedSearches(req("/api/saved-searches/")));
    expect(bob.savedSearches).toEqual([]);
    expect(bob.count).toBe(0);

    signIn("alice");
    expect((await body(await getSavedSearches(req("/api/saved-searches/")))).count).toBe(1);

    /* Bob cannot delete Alice's saved search even with its id, and gets the
       same 404 an unknown id would produce, so ids cannot be probed. */
    signIn("bob");
    const forbidden = await deleteSavedSearch(req(`/api/saved-searches/${aliceRow.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: aliceRow.id }) });
    expect(forbidden.status).toBe(404);

    signIn("alice");
    expect((await body(await getSavedSearches(req("/api/saved-searches/")))).count).toBe(1);
  });

  it("ignores a userId forged in the request body", async () => {
    signIn("bob");
    await postSavedSearch(jsonPost("/api/saved-searches/", { query: "Bob's search", userId: "alice" }));

    signIn("alice");
    expect((await body(await getSavedSearches(req("/api/saved-searches/")))).count).toBe(0);
    signIn("bob");
    expect((await body(await getSavedSearches(req("/api/saved-searches/")))).count).toBe(1);
  });

  it("lets two accounts save the identical search independently", async () => {
    signIn("alice");
    expect((await postSavedSearch(jsonPost("/api/saved-searches/", { query: "3 BHK Paldi" }))).status).toBe(201);
    signIn("bob");
    /* 201, not 200-as-duplicate: before the dedupe key was scoped to the
       owner, Bob's save silently returned Alice's row. */
    expect((await postSavedSearch(jsonPost("/api/saved-searches/", { query: "3 BHK Paldi" }))).status).toBe(201);
    expect((await body(await getSavedSearches(req("/api/saved-searches/")))).count).toBe(1);
  });
});

describe("lead inbox is isolated per organization", () => {
  function seedLead(organizationId: string, name: string, key: string) {
    const result = createLead({
      listingId: "garden-courtyard", organizationId, name, phone: "+91 98765 43210",
      message: "I would like more details about this property.",
      consentText: "I consent to masked contact.", idempotencyKey: key,
    });
    if (!result.ok) throw new Error(result.errors.join(" "));
    return result.lead;
  }

  it("shows organization B nothing belonging to organization A", async () => {
    const alphaLead = seedLead(ORG_A.id, "Alpha Buyer", "iso-a");
    seedLead(ORG_B.id, "Beta Buyer", "iso-b");

    signIn("broker-b", ORG_B);
    const betaInbox = await body(await getLeads(req("/api/broker/leads/")));
    expect((betaInbox.leads as Array<{ name: string }>).map((l) => l.name)).toEqual(["Beta Buyer"]);

    signIn("broker-a", ORG_A);
    const alphaInbox = await body(await getLeads(req("/api/broker/leads/")));
    expect((alphaInbox.leads as Array<{ name: string }>).map((l) => l.name)).toEqual(["Alpha Buyer"]);

    /* Organization B must not be able to act on organization A's lead. */
    signIn("broker-b", ORG_B);
    const del = await deleteLead(req(`/api/broker/leads/${alphaLead.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: alphaLead.id }) });
    expect(del.status).toBe(404);

    const reply = await replyToLead(jsonPost(`/api/broker/leads/${alphaLead.id}/reply`, { status: "CLOSED" }), { params: Promise.resolve({ id: alphaLead.id }) });
    expect(reply.status).toBe(404);

    /* ...and the lead is untouched. */
    signIn("broker-a", ORG_A);
    const after = await body(await getLeads(req("/api/broker/leads/")));
    expect((after.leads as Array<{ status: string }>)[0].status).toBe("NEW");
  });

  it("a read-only inbox session may watch but must not mutate (second-audit flagged note)", async () => {
    const lead = seedLead(ORG_A.id, "Alpha Buyer", "iso-ro");
    signInReadOnly("watcher-a", ORG_A);

    /* Read works — the read grant is real. */
    expect((await getLeads(req("/api/broker/leads/"))).status).toBe(200);

    /* Writes do not: reply, delete, and consent-revoke all require
       lead.inbox.write now, not merely lead.inbox.read. */
    const reply = await replyToLead(jsonPost(`/api/broker/leads/${lead.id}/reply`, { status: "ACKNOWLEDGED" }), { params: Promise.resolve({ id: lead.id }) });
    expect(reply.status).toBeGreaterThanOrEqual(400);
    const del = await deleteLead(req(`/api/broker/leads/${lead.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: lead.id }) });
    expect(del.status).toBeGreaterThanOrEqual(400);
    const revoke = await deleteLead(req(`/api/broker/leads/${lead.id}?mode=consent`, { method: "DELETE" }), { params: Promise.resolve({ id: lead.id }) });
    expect(revoke.status).toBeGreaterThanOrEqual(400);

    /* And a full-grant member of the same org still can — the gate is
       narrowed, not shut. */
    signIn("broker-a", ORG_A);
    const ok = await replyToLead(jsonPost(`/api/broker/leads/${lead.id}/reply`, { status: "ACKNOWLEDGED" }), { params: Promise.resolve({ id: lead.id }) });
    expect(ok.status).toBe(200);
  });

  it("lets an organization act on its own lead", async () => {
    const lead = seedLead(ORG_A.id, "Alpha Buyer", "iso-own");
    signIn("broker-a", ORG_A);
    const reply = await replyToLead(jsonPost(`/api/broker/leads/${lead.id}/reply`, { status: "ACKNOWLEDGED" }), { params: Promise.resolve({ id: lead.id }) });
    expect(reply.status).toBe(200);
  });

  it("refuses the inbox to a session with no organization", async () => {
    seedLead(ORG_A.id, "Alpha Buyer", "iso-noorg");
    signIn("plain-buyer");
    const response = await getLeads(req("/api/broker/leads/"));
    /* A buyer holds no lead.inbox.read grant, so this is a permission
       failure -- the point is that it is NOT a 200 with somebody's leads. */
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect((await body(response)).leads).toBeUndefined();
  });
});
