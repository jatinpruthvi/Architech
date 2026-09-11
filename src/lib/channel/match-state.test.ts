import { describe, expect, it } from "vitest";
import {
  acceptMatch,
  describeViewState,
  hasAccepted,
  rejectMatch,
  sideFor,
  viewStateFor,
  type MatchRecord,
} from "./match-state";

const DEMAND_ORG = "org_demand";
const SUPPLY_ORG = "org_supply";
const NOW = new Date("2026-09-04T10:00:00Z");
const EARLIER = new Date("2026-09-03T10:00:00Z");

const match = (over: Partial<MatchRecord> = {}): MatchRecord => ({
  id: "match_1",
  demandOrganizationId: DEMAND_ORG,
  supplyOrganizationId: SUPPLY_ORG,
  status: "SUGGESTED",
  demandAcceptedAt: null,
  supplyAcceptedAt: null,
  rejectedAt: null,
  rejectedByOrgId: null,
  connectedAt: null,
  ...over,
});

describe("identifying the viewer's side", () => {
  it("places each participant on its own side", () => {
    expect(sideFor(match(), DEMAND_ORG)).toBe("DEMAND");
    expect(sideFor(match(), SUPPLY_ORG)).toBe("SUPPLY");
  });

  it("returns null for an outsider rather than throwing", () => {
    expect(sideFor(match(), "org_nosy")).toBeNull();
  });

  it("reads the accept flag for the correct side", () => {
    const m = match({ demandAcceptedAt: EARLIER });
    expect(hasAccepted(m, "DEMAND")).toBe(true);
    expect(hasAccepted(m, "SUPPLY")).toBe(false);
  });
});

describe("accepting", () => {
  it("records the first accept without connecting", () => {
    // The whole safety property: one accept must not reveal anything.
    const result = acceptMatch(match(), DEMAND_ORG, NOW);
    expect(result).toEqual({
      ok: true,
      changes: { demandAcceptedAt: NOW, status: "ACCEPTED" },
      connected: false,
    });
  });

  it("connects on the second accept", () => {
    const result = acceptMatch(match({ demandAcceptedAt: EARLIER, status: "ACCEPTED" }), SUPPLY_ORG, NOW);
    expect(result).toEqual({
      ok: true,
      changes: { supplyAcceptedAt: NOW, status: "CONNECTED", connectedAt: NOW },
      connected: true,
    });
  });

  it("connects regardless of which side moved first", () => {
    // Evaluated against the post-change state; reading the stale record here
    // would leave the pair permanently one-sided.
    const result = acceptMatch(match({ supplyAcceptedAt: EARLIER, status: "ACCEPTED" }), DEMAND_ORG, NOW);
    expect(result.ok && result.connected).toBe(true);
  });

  it("refuses an outsider", () => {
    expect(acceptMatch(match(), "org_nosy", NOW)).toEqual({ ok: false, failure: "NOT_A_PARTICIPANT" });
  });

  it("refuses a second accept from the same side", () => {
    /* Otherwise a double-submit would overwrite the timestamp and re-fire the
       connection notification. */
    const m = match({ demandAcceptedAt: EARLIER, status: "ACCEPTED" });
    expect(acceptMatch(m, DEMAND_ORG, NOW)).toEqual({ ok: false, failure: "ALREADY_ACCEPTED" });
  });

  it("refuses to accept a rejected match", () => {
    const m = match({ rejectedAt: EARLIER, rejectedByOrgId: SUPPLY_ORG, status: "REJECTED" });
    expect(acceptMatch(m, DEMAND_ORG, NOW)).toEqual({ ok: false, failure: "ALREADY_REJECTED" });
  });

  it("refuses to accept an expired match", () => {
    expect(acceptMatch(match({ status: "EXPIRED" }), DEMAND_ORG, NOW)).toEqual({
      ok: false,
      failure: "MATCH_EXPIRED",
    });
  });

  it("never mutates the record it was given", () => {
    const m = match();
    acceptMatch(m, DEMAND_ORG, NOW);
    expect(m.demandAcceptedAt).toBeNull();
    expect(m.status).toBe("SUGGESTED");
  });
});

describe("rejecting", () => {
  it("records who declined, so it is auditable", () => {
    expect(rejectMatch(match(), SUPPLY_ORG, NOW)).toEqual({
      ok: true,
      changes: { rejectedAt: NOW, rejectedByOrgId: SUPPLY_ORG, status: "REJECTED" },
      connected: false,
    });
  });

  it("lets a side decline even after the other accepted", () => {
    // An agency that changed its mind must not be held to the connection.
    const m = match({ demandAcceptedAt: EARLIER, status: "ACCEPTED" });
    expect(rejectMatch(m, SUPPLY_ORG, NOW).ok).toBe(true);
  });

  it("refuses to decline once both sides connected", () => {
    /* The numbers are already exchanged. Offering an "undo" that cannot undo
       the disclosure would be a lie told by the UI. */
    const m = match({ demandAcceptedAt: EARLIER, supplyAcceptedAt: EARLIER, status: "CONNECTED" });
    expect(rejectMatch(m, DEMAND_ORG, NOW)).toEqual({ ok: false, failure: "ALREADY_ACCEPTED" });
  });

  it("refuses a second rejection", () => {
    const m = match({ rejectedAt: EARLIER, status: "REJECTED" });
    expect(rejectMatch(m, DEMAND_ORG, NOW)).toEqual({ ok: false, failure: "ALREADY_REJECTED" });
  });

  it("refuses an outsider", () => {
    expect(rejectMatch(match(), "org_nosy", NOW)).toEqual({ ok: false, failure: "NOT_A_PARTICIPANT" });
  });
});

describe("what each side sees", () => {
  it("asks the side that has not yet responded", () => {
    expect(viewStateFor(match(), DEMAND_ORG)).toBe("AWAITING_YOU");
  });

  it("shows the waiting side that the ball is elsewhere", () => {
    const m = match({ demandAcceptedAt: EARLIER, status: "ACCEPTED" });
    expect(viewStateFor(m, DEMAND_ORG)).toBe("AWAITING_THEM");
    expect(viewStateFor(m, SUPPLY_ORG)).toBe("AWAITING_YOU");
  });

  it("shows both sides the connection", () => {
    const m = match({ demandAcceptedAt: EARLIER, supplyAcceptedAt: NOW, status: "CONNECTED" });
    expect(viewStateFor(m, DEMAND_ORG)).toBe("CONNECTED");
    expect(viewStateFor(m, SUPPLY_ORG)).toBe("CONNECTED");
  });

  it("reports a decline to both sides without naming fault in the state", () => {
    const m = match({ rejectedAt: NOW, rejectedByOrgId: SUPPLY_ORG, status: "REJECTED" });
    expect(viewStateFor(m, DEMAND_ORG)).toBe("REJECTED");
    expect(viewStateFor(m, SUPPLY_ORG)).toBe("REJECTED");
  });

  it("prefers the decline over an expiry, since it is the real reason", () => {
    const m = match({ rejectedAt: NOW, status: "EXPIRED" });
    expect(viewStateFor(m, DEMAND_ORG)).toBe("REJECTED");
  });

  it("shows an outsider nothing", () => {
    expect(viewStateFor(match(), "org_nosy")).toBeNull();
  });

  it("has a human label for every state", () => {
    for (const state of ["AWAITING_YOU", "AWAITING_THEM", "CONNECTED", "REJECTED", "EXPIRED"] as const) {
      expect(describeViewState(state).length).toBeGreaterThan(3);
    }
  });
});
