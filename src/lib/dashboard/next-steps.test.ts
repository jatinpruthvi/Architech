/* "Next steps" across every role and every data shape.
 *
 * This is the part of the dashboard that tells a person what is waiting on
 * them, so a wrong prompt is worse than no prompt: telling an owner to "list
 * your first property" when they have three, or nagging a buyer about
 * listings they cannot create, discredits everything else on the page.
 */
import { describe, expect, it } from "vitest";
import { buildNextSteps, type NextStepsInput } from "./next-steps";
import { DASHBOARD_PERSONAS, type DashboardPersona } from "./persona";
import { panelsForPersona, visiblePanels } from "./panels";
import { permissionsForRole } from "@/lib/auth/roles";

/** Everything present and healthy; individual tests vary one axis. */
function input(overrides: Partial<NextStepsInput> = {}): NextStepsInput {
  const persona = overrides.persona ?? "buyer";
  return {
    persona,
    panels: panelsForPersona(persona),
    requirementCount: 1,
    drafts: [{ status: "ACTIVE" }],
    savedCount: 1,
    leadCount: 0,
    verificationStatus: "VERIFIED_PARTNER",
    ...overrides,
  };
}

const labels = (i: NextStepsInput) => buildNextSteps(i).map((s) => s.label);

describe("next steps, per role", () => {
  it("is silent for every role when nothing is outstanding", () => {
    for (const persona of DASHBOARD_PERSONAS) {
      expect(buildNextSteps(input({ persona })), `${persona} should have nothing waiting`).toEqual([]);
    }
  });

  it("prompts a brand-new account of every role to do something real", () => {
    for (const persona of DASHBOARD_PERSONAS) {
      const steps = buildNextSteps(input({
        persona, requirementCount: 0, drafts: [], savedCount: 0, leadCount: 0,
      }));
      expect(steps.length, `${persona} should be given a starting point`).toBeGreaterThan(0);
      for (const step of steps) expect(step.href).toMatch(/^\/[a-z0-9/-]*\/$/);
    }
  });

  describe("prompts never cross persona boundaries", () => {
    it("never tells a demand persona to list a property", () => {
      for (const persona of ["buyer", "tenant"] as const) {
        const steps = labels(input({ persona, requirementCount: 0, drafts: [], savedCount: 0 }));
        /* Word-boundary: "Shortlist a property" legitimately contains "list". */
        expect(steps.join(" ")).not.toMatch(/\blisting/i);
        expect(steps).not.toContain("List your first property");
        expect(steps).toContain("Tell us what you are looking for");
        expect(steps).toContain("Shortlist a property to compare later");
      }
    });

    it("never tells a supply persona to shortlist", () => {
      for (const persona of ["owner", "builder"] as const) {
        const steps = labels(input({ persona, requirementCount: 0, drafts: [], savedCount: 0 }));
        expect(steps).not.toContain("Shortlist a property to compare later");
        expect(steps).toContain("List your first property");
      }
    });

    it("gives the broker both sides", () => {
      const steps = labels(input({ persona: "broker", requirementCount: 0, drafts: [], leadCount: 3 }));
      expect(steps).toContain("List your first property");
      expect(steps).toContain("3 enquiries waiting for a reply");
    });
  });

  describe("a locked panel produces no prompt", () => {
    it("does not tell an un-onboarded owner to use a form they cannot reach", () => {
      /* The owner persona includes my-listings, but a BUYER-role account
         cannot load it. Prompting for it would send them into a wall. */
      const panels = visiblePanels("owner", permissionsForRole("BUYER"));
      const steps = labels(input({ persona: "owner", panels, requirementCount: 0, drafts: [], leadCount: 5 }));
      expect(steps).not.toContain("List your first property");
      expect(steps.join(" ")).not.toMatch(/enquir/i);
      /* What they CAN act on is still offered. */
      expect(steps).toContain("Tell us what you are looking for");
    });

    it("never emits a prompt for a panel absent from the visible set", () => {
      for (const persona of DASHBOARD_PERSONAS) {
        const steps = buildNextSteps(input({
          persona, panels: [], requirementCount: 0, drafts: [], savedCount: 0, leadCount: 9,
          verificationStatus: "DEMO",
        }));
        /* Only the verification prompt is panel-independent. */
        for (const step of steps) expect(step.href).toBe("/broker/onboarding/");
      }
    });
  });

  describe("draft states", () => {
    const owner = (drafts: Array<{ status: string }>) =>
      labels(input({ persona: "owner", drafts, requirementCount: 1 }));

    it("counts only the drafts a person can move forward", () => {
      expect(owner([{ status: "DRAFT" }, { status: "CHANGES_REQUESTED" }]))
        .toContain("2 listings need your attention before going live");
    });

    it("says nothing about terminal states", () => {
      /* ARCHIVED, REJECTED and DUPLICATE cannot be advanced; nagging is noise. */
      const steps = owner([{ status: "ARCHIVED" }, { status: "REJECTED" }, { status: "DUPLICATE" }]);
      expect(steps.join(" ")).not.toMatch(/attention|review/i);
    });

    it("reports listings in review separately, since they need patience not action", () => {
      expect(owner([{ status: "IN_REVIEW" }])).toContain("1 listing is in review");
    });

    it("treats an ACTIVE listing as done", () => {
      expect(owner([{ status: "ACTIVE" }])).toEqual([]);
    });

    it("does not say 'list your first property' to someone who has one", () => {
      expect(owner([{ status: "DRAFT" }])).not.toContain("List your first property");
    });

    it("gets singular and plural right", () => {
      expect(owner([{ status: "DRAFT" }])).toContain("1 listing needs your attention before going live");
      expect(owner([{ status: "IN_REVIEW" }, { status: "IN_REVIEW" }])).toContain("2 listings are in review");
    });
  });

  describe("enquiries", () => {
    it("prompts only when there is something to reply to", () => {
      expect(labels(input({ persona: "broker", leadCount: 0 })).join(" ")).not.toMatch(/enquir/i);
      expect(labels(input({ persona: "broker", leadCount: 1 }))).toContain("1 enquiry waiting for a reply");
    });
  });

  describe("verification", () => {
    it("nudges an unverified supply persona", () => {
      expect(labels(input({ persona: "owner", verificationStatus: "DEMO" })))
        .toContain("Get verified so your listings carry a trust badge");
    });

    it("stays quiet once verified either way", () => {
      for (const status of ["VERIFIED_PARTNER", "RERA_VERIFIED"]) {
        expect(labels(input({ persona: "builder", verificationStatus: status })).join(" "))
          .not.toMatch(/verified/i);
      }
    });

    it("never raises verification with a demand persona", () => {
      for (const persona of ["buyer", "tenant"] as const) {
        expect(labels(input({ persona, verificationStatus: "DEMO" })).join(" ")).not.toMatch(/verified/i);
      }
    });

    it("stays quiet for an account with no organization at all", () => {
      /* The locked panel already explains onboarding; a second prompt saying
         the same thing is nagging. */
      expect(labels(input({ persona: "owner", verificationStatus: null })).join(" ")).not.toMatch(/verified/i);
    });
  });

  it("produces no duplicate prompts for any role or data shape", () => {
    const shapes: Array<Partial<NextStepsInput>> = [
      { requirementCount: 0, drafts: [], savedCount: 0, leadCount: 0, verificationStatus: "DEMO" },
      { requirementCount: 5, drafts: [{ status: "DRAFT" }, { status: "IN_REVIEW" }], savedCount: 2, leadCount: 4 },
      { requirementCount: 0, drafts: [{ status: "CHANGES_REQUESTED" }], savedCount: 0, leadCount: 1 },
    ];
    for (const persona of DASHBOARD_PERSONAS) {
      for (const shape of shapes) {
        const steps = buildNextSteps(input({ persona, ...shape }));
        expect(new Set(steps.map((s) => s.label)).size).toBe(steps.length);
      }
    }
  });

  it("never emits an empty or malformed prompt", () => {
    for (const persona of DASHBOARD_PERSONAS) {
      const steps = buildNextSteps(input({
        persona, requirementCount: 0, drafts: [{ status: "DRAFT" }], savedCount: 0, leadCount: 2,
        verificationStatus: "DEMO",
      }));
      for (const step of steps) {
        expect(step.label.trim().length).toBeGreaterThan(5);
        expect(step.label).not.toMatch(/undefined|NaN|\[object/);
        expect(step.href.startsWith("/")).toBe(true);
      }
    }
  });

  it("tolerates an unknown persona without throwing", () => {
    expect(() => buildNextSteps(input({ persona: "nonsense" as DashboardPersona, panels: [] }))).not.toThrow();
  });
});
