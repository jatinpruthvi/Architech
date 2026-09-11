/* The role x panel matrix, driven against the REAL route handlers.
 *
 * The other dashboard suites each test one axis: personas, panel composition,
 * cross-panel prompts, tenant isolation. This one is the systematic sweep the
 * brief asks for -- every one of the five roles, every panel it is composed
 * of, exercised end to end through the actual API routes rather than mocks of
 * them.
 *
 * A role here is a (persona, AuthRole, organization) triple, because that is
 * what a real account is. Owner, tenant and builder are BUYER-role accounts:
 * that is not an oversight, it is the design -- see lib/dashboard/persona.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getRequirements, POST as postRequirement } from "../../../../app/api/requirements/route";
import { GET as getSavedSearches, POST as postSavedSearch } from "../../../../app/api/saved-searches/route";
import { GET as getLeads } from "../../../../app/api/broker/leads/route";
import { GET as getDrafts } from "../../../../app/api/broker/listings/route";
import { intentsForRole, resetRequirementStoreForTests } from "@/lib/requirements";
import { resetSavedSearchStoreForTests } from "@/lib/saved-search/saved-search";
import { resetLeadStoreForTests } from "@/lib/leads/lead";
import { permissionsForRole, type AuthRole, type AuthSession } from "@/lib/auth/roles";
import {
  DASHBOARD_PERSONAS,
  personasForSession,
  requirementRoleForPersona,
  resolvePersona,
  type DashboardPersona,
} from "./persona";
import { PANEL_META, lockedPanels, panelsForPersona, visiblePanels, type DashboardPanel } from "./panels";
import { buildNextSteps } from "./next-steps";

const currentSession = vi.hoisted(() => ({ value: null as AuthSession | null }));

vi.mock("@/lib/auth/live", () => ({
  getSessionContractForRequest: async () => ({
    session: currentSession.value,
    source: currentSession.value ? "better-auth-contract-demo" : "better-auth-signed-out",
    missing: [],
  }),
}));

const ORG: AuthSession["organization"] = {
  id: "demo-org-nivasa-partners", slug: "nivasa", name: "Nivasa Partners", verificationStatus: "VERIFIED_PARTNER",
};

/* The five roles as real accounts. Owner/tenant/builder are BUYER-role with a
   declared lister type; only the broker carries an organization. */
type RoleFixture = {
  persona: DashboardPersona;
  label: string;
  authRole: AuthRole;
  organization?: AuthSession["organization"];
  listerType?: "OWNER" | "BROKER";
};

const ROLES: RoleFixture[] = [
  { persona: "buyer", label: "Buyer", authRole: "BUYER" },
  { persona: "owner", label: "Owner", authRole: "BUYER", listerType: "OWNER" },
  { persona: "tenant", label: "Tenant", authRole: "BUYER" },
  { persona: "broker", label: "Broker/Agent", authRole: "BROKER_ADMIN", organization: ORG },
  { persona: "builder", label: "Builder", authRole: "BUYER" },
];

function signIn(fixture: RoleFixture, userId = `user-${fixture.persona}`): AuthSession {
  currentSession.value = {
    user: {
      id: userId, name: fixture.label, email: `${userId}@example.com`,
      role: fixture.authRole, listerType: fixture.listerType,
    },
    organization: fixture.organization,
    permissions: permissionsForRole(fixture.authRole),
    source: "better-auth-contract-demo",
  };
  return currentSession.value;
}

const req = (url: string) => new Request(`http://localhost:3000${url}`);
const post = (url: string, b: unknown) =>
  new Request(`http://localhost:3000${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;

let phoneSeed = 9000000000;
function briefFor(persona: DashboardPersona) {
  const role = requirementRoleForPersona(persona);
  return {
    intent: intentsForRole(role)[0],
    citySlug: "mumbai", category: "residential", subtype: "Flat/Apartment",
    localitySlugs: ["powai"], role,
    name: `${persona} person`, phone: String(phoneSeed++),
    consentText: "I agree to be contacted about this requirement.",
  };
}

/** Which API backs each panel, for the panels that load data. */
const PANEL_ENDPOINT: Partial<Record<DashboardPanel, { handler: (r: Request) => Promise<Response>; key: string }>> = {
  requirements: { handler: getRequirements, key: "requirements" },
  "saved-searches": { handler: getSavedSearches, key: "savedSearches" },
  "my-listings": { handler: getDrafts, key: "drafts" },
  enquiries: { handler: getLeads, key: "leads" },
};

beforeEach(() => {
  resetRequirementStoreForTests();
  resetSavedSearchStoreForTests();
  resetLeadStoreForTests();
  currentSession.value = null;
});

describe.each(ROLES)("$label dashboard, end to end", (fixture) => {
  it("resolves to its own persona and may select it", () => {
    const session = signIn(fixture);
    expect(personasForSession(session)).toContain(fixture.persona);
    expect(resolvePersona(session, fixture.persona)).toBe(fixture.persona);
  });

  it("renders at least one panel it can actually load", () => {
    const session = signIn(fixture);
    const visible = visiblePanels(fixture.persona, session.permissions);
    expect(visible.length).toBeGreaterThan(0);
    for (const panel of visible) {
      const required = PANEL_META[panel].permission;
      if (required) expect(session.permissions).toContain(required);
    }
  });

  it("every panel it is composed of is either visible or explained as locked", () => {
    const session = signIn(fixture);
    const visible = visiblePanels(fixture.persona, session.permissions);
    const locked = lockedPanels(fixture.persona, session.permissions);
    expect([...visible, ...locked].sort()).toEqual([...panelsForPersona(fixture.persona)].sort());
    /* Nothing may silently disappear from the composition. */
    expect(visible.filter((p) => locked.includes(p))).toEqual([]);
  });

  it("can file a requirement with a role-appropriate intent and read it back", async () => {
    signIn(fixture);
    const created = await postRequirement(post("/api/requirements/", briefFor(fixture.persona)));
    expect(created.status).toBe(201);

    const listed = await json(await getRequirements(req("/api/requirements/")));
    expect(listed.count).toBe(1);
    const [record] = listed.requirements as Array<Record<string, string>>;
    expect(record.role).toBe(requirementRoleForPersona(fixture.persona));
    /* Never a plaintext number on the read path. */
    expect(record.phoneMasked).toMatch(/^•••• ••• \d{4}$/);
    expect(JSON.stringify(record)).not.toMatch(/\d{10}/);
  });

  it("cannot file a requirement whose intent its role forbids", async () => {
    signIn(fixture);
    const role = requirementRoleForPersona(fixture.persona);
    const allowed = new Set(intentsForRole(role));
    const forbidden = (["buy", "rent", "list_sale", "list_rent"] as const).find((i) => !allowed.has(i));
    if (!forbidden) return; // agent legitimately has every intent
    const response = await postRequirement(post("/api/requirements/", { ...briefFor(fixture.persona), intent: forbidden }));
    expect(response.status).toBe(400);
    expect((await json(response)).errors).toContain("That option does not match the role you selected.");
  });

  it("every visible data panel answers without an authorisation error", async () => {
    const session = signIn(fixture);
    for (const panel of visiblePanels(fixture.persona, session.permissions)) {
      const endpoint = PANEL_ENDPOINT[panel];
      if (!endpoint) continue;
      const response = await endpoint.handler(req("/api/x/"));
      expect(response.status, `${fixture.label} / ${panel}`).toBe(200);
      const payload = await json(response);
      expect(payload.ok, `${fixture.label} / ${panel}`).toBe(true);
      expect(Array.isArray(payload[endpoint.key]), `${fixture.label} / ${panel} -> ${endpoint.key}`).toBe(true);
    }
  });

  it("every LOCKED data panel really is refused, so locking it was honest", async () => {
    const session = signIn(fixture);
    for (const panel of lockedPanels(fixture.persona, session.permissions)) {
      const endpoint = PANEL_ENDPOINT[panel];
      if (!endpoint) continue;
      const response = await endpoint.handler(req("/api/x/"));
      /* If this returned 200 the panel was locked for no reason and the role
         is being denied something it could have had. */
      expect(response.status, `${fixture.label} / ${panel} should be refused`).toBeGreaterThanOrEqual(400);
    }
  });

  it("saves and reads back a saved search when that panel is available", async () => {
    const session = signIn(fixture);
    if (!visiblePanels(fixture.persona, session.permissions).includes("saved-searches")) return;
    expect((await postSavedSearch(post("/api/saved-searches/", { query: `${fixture.label} search`, notify: true }))).status).toBe(201);
    const listed = await json(await getSavedSearches(req("/api/saved-searches/")));
    expect(listed.count).toBe(1);
  });

  it("gets sensible next steps as a brand-new account, and none once settled", async () => {
    const session = signIn(fixture);
    const panels = visiblePanels(fixture.persona, session.permissions);

    const fresh = buildNextSteps({
      persona: fixture.persona, panels, requirementCount: 0, drafts: [], savedCount: 0, leadCount: 0,
      verificationStatus: session.organization?.verificationStatus ?? null,
    });
    expect(fresh.length, `${fixture.label} needs a starting point`).toBeGreaterThan(0);

    const settled = buildNextSteps({
      persona: fixture.persona, panels, requirementCount: 2, drafts: [{ status: "ACTIVE" }], savedCount: 3, leadCount: 0,
      verificationStatus: session.organization?.verificationStatus ?? null,
    });
    expect(settled, `${fixture.label} should be left alone when nothing is waiting`).toEqual([]);
  });

  it("keeps its data private from a second account of the same role", async () => {
    signIn(fixture, "user-first");
    await postRequirement(post("/api/requirements/", briefFor(fixture.persona)));
    await postSavedSearch(post("/api/saved-searches/", { query: "first account search" }));

    signIn(fixture, "user-second");
    expect((await json(await getRequirements(req("/api/requirements/")))).count).toBe(0);
    const searches = await json(await getSavedSearches(req("/api/saved-searches/")));
    /* A broker shares an organization but NOT a personal saved-search list. */
    expect(searches.count).toBe(0);

    signIn(fixture, "user-first");
    expect((await json(await getRequirements(req("/api/requirements/")))).count).toBe(1);
  });
});

describe("the matrix itself is complete", () => {
  it("covers all five personas the product names", () => {
    expect(ROLES.map((r) => r.persona).sort()).toEqual([...DASHBOARD_PERSONAS].sort());
  });

  it("exercises every panel that loads data from an API", () => {
    /* Any panel added with a backing endpoint must appear in some role's
       composition, or it is dead code no dashboard can reach. */
    const composed = new Set(ROLES.flatMap((r) => panelsForPersona(r.persona)));
    for (const panel of Object.keys(PANEL_ENDPOINT) as DashboardPanel[]) {
      expect(composed.has(panel), `${panel} is not on any role's dashboard`).toBe(true);
    }
  });

  it("names a real AuthRole for every fixture", () => {
    for (const fixture of ROLES) expect(() => permissionsForRole(fixture.authRole)).not.toThrow();
  });
});
