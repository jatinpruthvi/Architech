import { describe, expect, it } from "vitest";
import { DASHBOARD_PANELS, PANEL_META, panelsForPersona, visiblePanels } from "./panels";
import { DASHBOARD_PERSONAS } from "./persona";
import { permissionsForRole } from "@/lib/auth/roles";

describe("dashboard panels", () => {
  it("gives every persona a non-empty composition", () => {
    for (const persona of DASHBOARD_PERSONAS) {
      expect(panelsForPersona(persona).length).toBeGreaterThan(0);
    }
  });

  it("describes every declared panel", () => {
    for (const panel of DASHBOARD_PANELS) {
      const meta = PANEL_META[panel];
      expect(meta.title.length).toBeGreaterThan(0);
      /* An empty state must say what the panel is FOR, not just that it is
         empty -- an empty dashboard is the first thing a new user sees. */
      expect(meta.emptyBody.length).toBeGreaterThan(20);
      expect(meta.href.startsWith("/")).toBe(true);
      expect(meta.actionLabel.length).toBeGreaterThan(0);
    }
  });

  it("never lists a panel twice for one persona", () => {
    for (const persona of DASHBOARD_PERSONAS) {
      const panels = panelsForPersona(persona);
      expect(new Set(panels).size).toBe(panels.length);
    }
  });

  it("returns a copy so a caller cannot mutate the composition", () => {
    const first = panelsForPersona("buyer");
    first.push("channel");
    expect(panelsForPersona("buyer")).not.toContain("channel");
  });

  describe("demand vs supply composition", () => {
    it("opens demand personas on what they asked for and saved", () => {
      for (const persona of ["buyer", "tenant"] as const) {
        const panels = panelsForPersona(persona);
        expect(panels).toContain("requirements");
        expect(panels).toContain("saved-properties");
        /* A buyer has no listings to manage and no channel to trade on. */
        expect(panels).not.toContain("my-listings");
        expect(panels).not.toContain("channel");
      }
    });

    it("opens supply personas on the property they are trying to move", () => {
      for (const persona of ["owner", "builder"] as const) {
        const panels = panelsForPersona(persona);
        expect(panels).toContain("my-listings");
        expect(panels).toContain("enquiries");
        expect(panels).toContain("verification");
        expect(panels).not.toContain("channel");
      }
    });

    it("gives the broker both sides plus the channel", () => {
      const panels = panelsForPersona("broker");
      expect(panels).toContain("my-listings");
      expect(panels).toContain("enquiries");
      expect(panels).toContain("channel");
    });
  });

  describe("visiblePanels enforces permission on top of composition", () => {
    it("hides the channel from a session without channel.read", () => {
      expect(visiblePanels("broker", permissionsForRole("BUYER"))).not.toContain("channel");
    });

    it("shows the channel to a broker member", () => {
      expect(visiblePanels("broker", permissionsForRole("BROKER_MEMBER"))).toContain("channel");
    });

    it("hides enquiries from an owner with no lead.inbox.read grant", () => {
      /* An owner persona on a BUYER role sees the panel set for owners, but
         the enquiry data belongs to a guarded API, so the panel is withheld
         rather than rendered empty and broken. */
      expect(visiblePanels("owner", permissionsForRole("BUYER"))).not.toContain("enquiries");
      expect(visiblePanels("owner", permissionsForRole("BUYER"))).toContain("my-listings");
    });

    it("keeps unguarded panels for every persona and every role", () => {
      for (const persona of DASHBOARD_PERSONAS) {
        const visible = visiblePanels(persona, []);
        expect(visible).toContain("next-steps");
        for (const panel of visible) expect(PANEL_META[panel].permission).toBeNull();
      }
    });

    it("never returns a panel outside the persona's composition", () => {
      const everyPermission = DASHBOARD_PANELS.map((p) => PANEL_META[p].permission).filter((p): p is string => p !== null);
      for (const persona of DASHBOARD_PERSONAS) {
        const composition = new Set(panelsForPersona(persona));
        for (const panel of visiblePanels(persona, everyPermission)) {
          expect(composition.has(panel)).toBe(true);
        }
      }
    });
  });
});
