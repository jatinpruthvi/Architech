/* End-to-end contract for the dashboard, exercised for all five roles.
 *
 * The user's request was "make sure we have all the functionality of Dashboard
 * working end to end for all different roles". These tests drive the real
 * route handlers — not mocks of them — so a regression in the API, the
 * ownership scoping, or the persona model fails here.
 *
 * The single most important assertion in this file is the isolation one:
 * requirements filed by one account must never appear on another account's
 * dashboard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getRequirements, POST as postRequirement } from "../../../../app/api/requirements/route";
import { intentsForRole, resetRequirementStoreForTests, type RequirementRecord } from "@/lib/requirements";
import {
  DASHBOARD_PERSONAS,
  defaultPersonaForSession,
  personasForSession,
  resolvePersona,
  requirementRoleForPersona,
  type DashboardPersona,
} from "./persona";
import { lockedPanels, panelsForPersona, visiblePanels, PANEL_META } from "./panels";
import { permissionsForRole, type AuthSession } from "@/lib/auth/roles";

/* The requirement API reads the session through `getSessionContractForRequest`.
   Stubbing that one module lets these tests drive the REAL handler while
   choosing who is signed in. */
const currentSession = vi.hoisted(() => ({ value: null as AuthSession | null }));

vi.mock("@/lib/auth/live", () => ({
  getSessionContractForRequest: async () => ({
    session: currentSession.value,
    source: currentSession.value ? "better-auth-contract-demo" : "better-auth-signed-out",
    missing: [],
  }),
}));

function asUser(id: string, overrides: Partial<AuthSession["user"]> = {}, organization?: AuthSession["organization"]) {
  currentSession.value = {
    user: { id, name: `User ${id}`, email: `${id}@example.com`, role: "BUYER", ...overrides },
    organization,
    permissions: permissionsForRole(overrides.role ?? "BUYER"),
    source: "better-auth-contract-demo",
  };
  return currentSession.value;
}

const ORG: AuthSession["organization"] = {
  id: "org-1", slug: "org", name: "Partner Org", verificationStatus: "VERIFIED_PARTNER",
};

/* A same-origin POST. `enforceMutationSafety` allows a missing Origin in
   development, which is what the test environment is. */
function postBody(body: unknown) {
  return new Request("http://localhost:3000/api/requirements/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const getRequest = () => new Request("http://localhost:3000/api/requirements/");

/** A valid brief for a given persona, in a city/locality the fixtures know. */
function briefFor(persona: DashboardPersona, phone: string) {
  const role = requirementRoleForPersona(persona);
  /* Intent must be one the ROLE actually permits -- a tenant may only rent,
     an owner may only list. `intentsForRole` is the same contract the form
     renders from, so this helper cannot drift from the validator. */
  const intent = intentsForRole(role)[0];
  return {
    intent,
    citySlug: "mumbai",
    category: "residential",
    subtype: "Flat/Apartment",
    localitySlugs: ["andheri-west"],
    role,
    name: `${persona} person`,
    phone,
    consentText: "I agree to be contacted about this requirement.",
  };
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  resetRequirementStoreForTests();
  currentSession.value = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("dashboard end to end, per role", () => {
  it("accepts a brief and reads it back for every one of the five personas", async () => {
    let phone = 9000000000;
    for (const persona of DASHBOARD_PERSONAS) {
      resetRequirementStoreForTests();
      const userId = `user-${persona}`;
      const isBroker = persona === "broker";
      asUser(userId, { role: isBroker ? "BROKER_ADMIN" : "BUYER" }, isBroker ? ORG : undefined);

      const created = await postRequirement(postBody(briefFor(persona, String(phone++))));
      expect(created.status, `${persona} should be able to file a brief`).toBe(201);

      const listed = await json(await getRequirements(getRequest()));
      const requirements = listed.requirements as RequirementRecord[];
      expect(requirements, `${persona} should see their own brief`).toHaveLength(1);
      expect(requirements[0].role).toBe(requirementRoleForPersona(persona));
      /* A read path must never hand back a phone number. */
      expect(JSON.stringify(requirements[0])).not.toContain(String(phone - 1));
      expect(requirements[0].phoneMasked).toMatch(/^•••• ••• \d{4}$/);
    }
  });

  it("never shows one account's requirement to another account", async () => {
    asUser("user-alice");
    expect((await postRequirement(postBody(briefFor("buyer", "9111111111")))).status).toBe(201);

    asUser("user-bob");
    const bobsView = await json(await getRequirements(getRequest()));
    expect(bobsView.requirements).toEqual([]);
    expect(bobsView.count).toBe(0);

    asUser("user-alice");
    expect((await json(await getRequirements(getRequest()))).count).toBe(1);
  });

  it("does not let a caller claim someone else's requirements by forging a body field", async () => {
    asUser("user-alice");
    await postRequirement(postBody(briefFor("buyer", "9222222222")));

    /* Bob posts a brief while asserting he is Alice. Ownership is taken from
       the session, so the row must land on BOB's dashboard, not Alice's. */
    asUser("user-bob");
    await postRequirement(postBody({ ...briefFor("buyer", "9333333333"), userId: "user-alice" }));

    asUser("user-alice");
    const alice = await json(await getRequirements(getRequest()));
    expect(alice.count).toBe(1);

    asUser("user-bob");
    expect((await json(await getRequirements(getRequest()))).count).toBe(1);
  });

  it("returns an empty list, not an error, to a signed-out visitor", async () => {
    currentSession.value = null;
    const response = await getRequirements(getRequest());
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.requirements).toEqual([]);
  });

  it("keeps two people who share a phone number on separate dashboards", async () => {
    /* One household, one handset. Before ownership was part of the
       idempotency key the second brief was swallowed as a duplicate. */
    const shared = "9876543210";
    asUser("user-parent");
    expect((await postRequirement(postBody(briefFor("buyer", shared)))).status).toBe(201);

    asUser("user-child");
    expect((await postRequirement(postBody(briefFor("buyer", shared)))).status).toBe(201);

    expect((await json(await getRequirements(getRequest()))).count).toBe(1);
    asUser("user-parent");
    expect((await json(await getRequirements(getRequest()))).count).toBe(1);
  });

  it("still treats a genuine resubmission by the same person as idempotent", async () => {
    asUser("user-alice");
    const brief = briefFor("buyer", "9444444444");
    expect((await postRequirement(postBody(brief))).status).toBe(201);
    expect((await postRequirement(postBody(brief))).status).toBe(200);
    expect((await json(await getRequirements(getRequest()))).count).toBe(1);
  });

  it("rejects a brief whose intent contradicts the role", async () => {
    asUser("user-tenant");
    const response = await postRequirement(postBody({ ...briefFor("tenant", "9555555555"), intent: "list_sale" }));
    expect(response.status).toBe(400);
    expect((await json(response)).errors).toContain("That option does not match the role you selected.");
  });
});

describe("what each role is shown", () => {
  it("gives every role a dashboard with at least one loadable panel", () => {
    const cases: Array<[DashboardPersona, AuthSession]> = [
      ["buyer", asUser("u", { role: "BUYER" })],
      ["tenant", asUser("u", { role: "BUYER" })],
      ["owner", asUser("u", { role: "BUYER", listerType: "OWNER" })],
      ["builder", asUser("u", { role: "BUYER" })],
      ["broker", asUser("u", { role: "BROKER_ADMIN" }, ORG)],
    ];
    for (const [persona, session] of cases) {
      const visible = visiblePanels(persona, session.permissions);
      expect(visible.length, `${persona} must have panels`).toBeGreaterThan(0);
      for (const panel of visible) {
        const required = PANEL_META[panel].permission;
        if (required) expect(session.permissions).toContain(required);
      }
    }
  });

  it("shows a buyer no panel that needs broker authority", () => {
    const buyer = asUser("u", { role: "BUYER" });
    for (const persona of personasForSession(buyer)) {
      for (const panel of visiblePanels(persona, buyer.permissions)) {
        expect(PANEL_META[panel].permission).not.toBe("channel.read");
        expect(PANEL_META[panel].permission).not.toBe("lead.inbox.read");
      }
    }
  });

  it("degrades a supply persona gracefully for an un-onboarded owner", () => {
    /* An owner is a BUYER role with no organization. They still get a real
       dashboard: their listings and requirements, minus the guarded enquiry
       inbox. This is the case that previously showed "no access". */
    const owner = asUser("u", { role: "BUYER", listerType: "OWNER" });
    expect(defaultPersonaForSession(owner)).toBe("owner");
    const visible = visiblePanels("owner", owner.permissions);
    /* What they CAN use straight away. */
    expect(visible).toContain("requirements");
    expect(visible).toContain("verification");
    /* Listings and enquiries are organization-scoped, so they are locked with
       an explanation rather than rendered as empty lists that would tell the
       owner they have no properties. */
    const locked = lockedPanels("owner", owner.permissions);
    expect(locked).toContain("my-listings");
    expect(locked).toContain("enquiries");
    expect(visible).not.toContain("enquiries");
  });

  it("lands a verified broker on the broker persona with the channel available", () => {
    const broker = asUser("u", { role: "BROKER_ADMIN" }, ORG);
    expect(defaultPersonaForSession(broker)).toBe("broker");
    expect(visiblePanels("broker", broker.permissions)).toContain("channel");
  });

  it("refuses to hand the broker persona to a self-declared broker who was never onboarded", () => {
    const pretender = asUser("u", { role: "BUYER", listerType: "BROKER" });
    expect(resolvePersona(pretender, "broker")).not.toBe("broker");
    expect(visiblePanels(resolvePersona(pretender, "broker"), pretender.permissions)).not.toContain("channel");
  });

  it("points every panel at a real in-app destination", () => {
    for (const persona of DASHBOARD_PERSONAS) {
      for (const panel of panelsForPersona(persona)) {
        expect(PANEL_META[panel].href).toMatch(/^\/[a-z0-9/-]*\/$/);
      }
    }
  });
});
