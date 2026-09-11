import { describe, expect, it } from "vitest";
import {
  DASHBOARD_PERSONAS,
  DEFAULT_PERSONA,
  defaultPersonaForSession,
  isDashboardPersona,
  isPersonaAvailable,
  personaForRequirementRole,
  personasForSession,
  requirementRoleForPersona,
  resolvePersona,
} from "./persona";
import type { AuthSession } from "@/lib/auth/roles";

function session(overrides: Partial<AuthSession["user"]> = {}, organization?: AuthSession["organization"]): AuthSession {
  return {
    user: { id: "u1", name: "Test", email: "t@example.com", role: "BUYER", ...overrides },
    organization,
    permissions: [],
    source: "better-auth-contract-demo",
  };
}

const brokerOrg: AuthSession["organization"] = {
  id: "org1", slug: "org", name: "Org", verificationStatus: "VERIFIED_PARTNER",
};

describe("dashboard personas", () => {
  it("covers the five personas the product speaks of", () => {
    expect([...DASHBOARD_PERSONAS]).toEqual(["buyer", "owner", "tenant", "broker", "builder"]);
  });

  it("recognises valid personas and rejects anything else", () => {
    for (const persona of DASHBOARD_PERSONAS) expect(isDashboardPersona(persona)).toBe(true);
    for (const bad of ["BUYER", "admin", "", null, undefined, 7, {}]) {
      expect(isDashboardPersona(bad)).toBe(false);
    }
  });

  describe("availability is not authority", () => {
    it("offers the four non-privileged personas to a plain buyer", () => {
      expect(personasForSession(session())).toEqual(["buyer", "owner", "tenant", "builder"]);
    });

    it("does NOT offer the broker persona to a buyer who merely declared BROKER at sign-up", () => {
      /* listerType is self-asserted and must never grant anything. */
      const declared = session({ listerType: "BROKER" });
      expect(personasForSession(declared)).not.toContain("broker");
      expect(isPersonaAvailable(declared, "broker")).toBe(false);
    });

    it("does NOT offer the broker persona to a broker role without an organization", () => {
      expect(isPersonaAvailable(session({ role: "BROKER_ADMIN" }), "broker")).toBe(false);
    });

    it("offers the broker persona only with role AND organization", () => {
      const broker = session({ role: "BROKER_MEMBER" }, brokerOrg);
      expect(personasForSession(broker)).toContain("broker");
      expect(personasForSession(broker)[0]).toBe("broker");
    });

    it("offers nothing privileged to a signed-out visitor", () => {
      expect(personasForSession(null)).toEqual(["buyer", "owner", "tenant", "builder"]);
      expect(isPersonaAvailable(null, "broker")).toBe(false);
    });
  });

  describe("defaults", () => {
    it("lands a verified broker on their working desk", () => {
      expect(defaultPersonaForSession(session({ role: "BROKER_ADMIN" }, brokerOrg))).toBe("broker");
    });

    it("uses the sign-up declaration when there is no broker authority", () => {
      expect(defaultPersonaForSession(session({ listerType: "OWNER" }))).toBe("owner");
    });

    it("falls back to buyer, the least presumptuous default", () => {
      expect(defaultPersonaForSession(session())).toBe(DEFAULT_PERSONA);
      expect(defaultPersonaForSession(null)).toBe("buyer");
    });
  });

  describe("resolvePersona never widens access", () => {
    it("honours an available requested persona", () => {
      expect(resolvePersona(session(), "tenant")).toBe("tenant");
    });

    it("falls back rather than granting an unavailable persona", () => {
      expect(resolvePersona(session(), "broker")).toBe("buyer");
    });

    it("ignores junk without throwing", () => {
      for (const bad of ["../../etc", "", null, undefined, 42, ["broker"]]) {
        expect(resolvePersona(session(), bad)).toBe("buyer");
      }
    });

    it("lets a genuine broker resolve to broker", () => {
      expect(resolvePersona(session({ role: "BROKER_ADMIN" }, brokerOrg), "broker")).toBe("broker");
    });
  });

  describe("requirement role mapping round-trips", () => {
    it("maps every persona to a requirement role and back", () => {
      for (const persona of DASHBOARD_PERSONAS) {
        expect(personaForRequirementRole(requirementRoleForPersona(persona))).toBe(persona);
      }
    });

    it("files broker intent under the agent role the contract already models", () => {
      expect(requirementRoleForPersona("broker")).toBe("agent");
    });
  });
});
