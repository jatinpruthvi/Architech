import { describe, expect, it } from "vitest";
import { DASHBOARD_PANELS, PANEL_LOCK_REASON, PANEL_META, lockedPanels, panelsForPersona, visiblePanels } from "./panels";
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

    it("withholds guarded supply panels from an un-onboarded owner, but reports them as locked", () => {
      /* Listings and enquiries are organization-scoped, and a BUYER-role
         owner holds neither grant. The panels must not render as loadable...
         */
      const visible = visiblePanels("owner", permissionsForRole("BUYER"));
      expect(visible).not.toContain("enquiries");
      expect(visible).not.toContain("my-listings");

      /* ...but they must not vanish either. Silently dropping "Your
         properties" leaves an owner wondering where it went; rendering it
         empty tells them they have none. Both lie. */
      const locked = lockedPanels("owner", permissionsForRole("BUYER"));
      expect(locked).toContain("my-listings");
      expect(locked).toContain("enquiries");
    });

    it("locks nothing for a fully-granted broker", () => {
      expect(lockedPanels("broker", permissionsForRole("BROKER_ADMIN"))).toEqual([]);
    });

    it("partitions every persona's composition into exactly visible + locked", () => {
      for (const persona of DASHBOARD_PERSONAS) {
        const permissions = permissionsForRole("BUYER");
        const visible = visiblePanels(persona, permissions);
        const locked = lockedPanels(persona, permissions);
        expect([...visible, ...locked].sort()).toEqual([...panelsForPersona(persona)].sort());
        /* No panel may be both. */
        expect(visible.filter((p) => locked.includes(p))).toEqual([]);
      }
    });

    it("explains every permission it can lock a panel on", () => {
      /* A locked panel with no reason renders a generic shrug. Every
         permission actually used by a panel must have copy. */
      for (const panel of DASHBOARD_PANELS) {
        const required = PANEL_META[panel].permission;
        if (required) expect(PANEL_LOCK_REASON[required], `${required} needs lock copy`).toBeDefined();
      }
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
