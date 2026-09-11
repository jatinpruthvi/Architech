/* The publish gate's contract.

   The gate is trusted with refusing listings, so the risk it carries is
   refusing the wrong ones. These tests are weighted towards that side: for
   every rule there is a case that must pass, not only a case that must fail.
   A gate tested only against bad input is a gate you do not dare switch on.

   `validateListingDraft` already enforces title, price, BHK, area, locality,
   type, availability, a 30-character description and media rights at creation.
   This gate deliberately does not re-check those — the "publishable listing"
   subject below satisfies them all, and every test perturbs exactly one thing,
   so a failure names its own cause. */
import { describe, expect, it } from "vitest";
import {
  DUPLICATE_SIMILARITY_THRESHOLD,
  MIN_DESCRIPTION_CHARS,
  THIN_DESCRIPTION_CHARS,
  evaluatePublishGate,
  descriptionSimilarity,
  type PublishGatePeer,
  type PublishGateSubject,
} from "./publish-gate";

/* Comfortably above the thin threshold. The baseline subject is meant to be a
   listing nobody would object to, so if it tripped the thin-description
   warning every warning assertion below would be ambiguous. The guard test
   under "a publishable listing" keeps this honest if the threshold moves. */
const LONG =
  "Old trees, kota stone floors, and a courtyard that carries the whole house through the day. The bedrooms open onto it, so the light moves across the house rather than into it. The kitchen was rebuilt last year in teak, and the back verandah stays cool through the afternoon.";

function subject(overrides: Partial<PublishGateSubject> = {}): PublishGateSubject {
  return {
    stableId: "listing_new",
    title: "A courtyard home in Paldi",
    description: LONG,
    priceInr: 18_500_000,
    bhk: 3,
    areaSqft: 1482,
    propertyType: "APARTMENT",
    availability: "RESALE",
    localitySlug: "paldi",
    mediaRightsConfirmed: true,
    mediaCount: 3,
    ...overrides,
  };
}

function peer(overrides: Partial<PublishGatePeer> = {}): PublishGatePeer {
  return {
    stableId: "listing_existing",
    title: "Courtyard home",
    description: LONG,
    localitySlug: "paldi",
    published: true,
    ...overrides,
  };
}

describe("descriptionSimilarity", () => {
  it("is 1 for identical text", () => {
    expect(descriptionSimilarity(LONG, LONG)).toBe(1);
  });

  it("sees a pasted paragraph with a few words changed as the same copy", () => {
    // The case that matters. A word-level comparison reads this as a
    // different document; character trigrams see the shared body.
    const padded = LONG.replace("kota stone floors", "kota-stone flooring").replace("courtyard", "courtyards");
    expect(descriptionSimilarity(LONG, padded)).toBeGreaterThan(DUPLICATE_SIMILARITY_THRESHOLD);
  });

  it("does not flag genuinely different descriptions", () => {
    const other =
      "A top-floor studio above the crossroads, with a balcony that catches the evening light and a kitchen rebuilt last year in teak and black granite.";
    expect(descriptionSimilarity(LONG, other)).toBeLessThan(DUPLICATE_SIMILARITY_THRESHOLD);
  });

  it("is 0 when either side is empty", () => {
    expect(descriptionSimilarity("", LONG)).toBe(0);
    expect(descriptionSimilarity(LONG, "")).toBe(0);
  });

  it("is symmetric", () => {
    const other = "A two bedroom flat near thelake with a small balcony and parking.";
    expect(descriptionSimilarity(LONG, other)).toBeCloseTo(descriptionSimilarity(other, LONG), 10);
  });
});

describe("a publishable listing", () => {
  it("uses a description that is not itself thin", () => {
    expect(LONG.length).toBeGreaterThanOrEqual(THIN_DESCRIPTION_CHARS);
  });

  it("publishes", () => {
    expect(evaluatePublishGate(subject())).toMatchObject({ action: "publish", blockers: [] });
  });

  it("publishes with no peers at all", () => {
    expect(evaluatePublishGate(subject(), [])).toMatchObject({ action: "publish" });
  });

  it("warns rather than blocks when RERA is missing on a resale", () => {
    // Individual resales are generally outside RERA. Blocking here would
    // refuse most legitimate resale inventory.
    const decision = evaluatePublishGate(subject({ reraNumber: undefined }));
    expect(decision.action).toBe("publish");
    expect(decision.warnings.join(" ")).toMatch(/RERA/);
  });

  it("does not warn about RERA when one is supplied", () => {
    const decision = evaluatePublishGate(subject({ reraNumber: "GUJ-RERA-12345" }));
    expect(decision.warnings).toEqual([]);
  });
});

describe("completeness blockers", () => {
  it("blocks a listing with no photographs, and says why", () => {
    const decision = evaluatePublishGate(subject({ mediaCount: 0 }));
    expect(decision.action).toBe("block");
    expect(decision.blockers.join(" ")).toMatch(/photograph/i);
  });

  it("blocks when media rights are not confirmed", () => {
    const decision = evaluatePublishGate(subject({ mediaRightsConfirmed: false }));
    expect(decision.blockers.join(" ")).toMatch(/media rights/i);
  });

  it("blocks a description that is a single clause, quoting the length", () => {
    // Thirty characters passes draft creation. It is not a description.
    const short = "Nice flat, good light, call now.";
    const decision = evaluatePublishGate(subject({ description: short }));
    expect(decision.action).toBe("block");
    expect(decision.blockers.join(" ")).toContain(`${short.length} characters`);
    expect(decision.blockers.join(" ")).toMatch(String(MIN_DESCRIPTION_CHARS));
  });

  it("warns about a thin description instead of blocking it", () => {
    const description = "A bright two bedroom flat on a quiet Paldi lane with a small balcony and one reserved parking space.";
    const decision = evaluatePublishGate(subject({ description }));
    expect(decision.action).toBe("publish");
    expect(decision.warnings.join(" ")).toMatch(/thin/i);
  });

  it("blocks an off-plan listing with no RERA number", () => {
    for (const availability of ["NEW_LAUNCH", "UNDER_CONSTRUCTION", "PRE_LAUNCH"] as const) {
      const decision = evaluatePublishGate(subject({ availability, reraNumber: undefined }));
      expect(decision.action).toBe("block");
      expect(decision.blockers.join(" ")).toMatch(/RERA/);
    }
  });

  it("publishes an off-plan listing that has one", () => {
    const decision = evaluatePublishGate(subject({ availability: "UNDER_CONSTRUCTION", reraNumber: "GUJ-RERA-999" }));
    expect(decision.action).toBe("publish");
  });

  it("reports every blocker at once, so the broker makes one round trip", () => {
    const decision = evaluatePublishGate(
      subject({ mediaCount: 0, mediaRightsConfirmed: false, description: "Too short." }),
    );
    expect(decision.blockers.length).toBe(3);
  });
});

describe("duplication", () => {
  it("canonicalizes a near-duplicate rather than refusing it", () => {
    // The third outcome. A duplicate is legitimate inventory; it just does not
    // deserve its own page.
    const decision = evaluatePublishGate(subject(), [peer()]);
    expect(decision.action).toBe("canonicalize");
    expect(decision.canonicalToListingId).toBe("listing_existing");
    expect(decision.similarity).toBeGreaterThan(0.9);
  });

  it("never canonicalizes to an unpublished peer", () => {
    // Pointing Google at a page that does not exist is worse than a duplicate.
    // This is the whole reason `published` exists on the peer shape.
    const decision = evaluatePublishGate(subject(), [peer({ published: false })]);
    expect(decision.action).toBe("publish");
    expect(decision.canonicalToListingId).toBeUndefined();
    expect(decision.warnings.join(" ")).toMatch(/similar description/i);
  });

  it("prefers the most similar published peer", () => {
    const closer = peer({ stableId: "listing_closer", description: LONG });
    const further = peer({ stableId: "listing_further", description: `${LONG} Additionally the society has a gym, a pool, and a small reading room on the ground floor.` });
    const decision = evaluatePublishGate(subject(), [further, closer]);
    expect(decision.canonicalToListingId).toBe("listing_closer");
  });

  it("ignores a duplicate description in another locality", () => {
    // The same paragraph in two cities is not a duplicate page.
    const decision = evaluatePublishGate(subject(), [peer({ localitySlug: "bopal" })]);
    expect(decision.action).toBe("publish");
  });

  it("ignores itself", () => {
    const decision = evaluatePublishGate(subject(), [peer({ stableId: "listing_new" })]);
    expect(decision.action).toBe("publish");
  });

  it("blocks a duplicate that is also incomplete, keeping both sets of reasons", () => {
    const decision = evaluatePublishGate(subject({ mediaCount: 0, description: "Short." }), [peer()]);
    expect(decision.action).toBe("block");
    expect(decision.blockers.length).toBeGreaterThan(0);
  });
});

describe("the gate's promise", () => {
  it("gives a reason a broker can act on for every blocker", () => {
    // A gate that returns false is a wall. Every blocker must be a sentence.
    const decision = evaluatePublishGate(
      subject({ mediaCount: 0, mediaRightsConfirmed: false, description: "x", availability: "NEW_LAUNCH" }),
    );
    expect(decision.blockers.length).toBeGreaterThan(0);
    for (const blocker of decision.blockers) {
      expect(blocker.length).toBeGreaterThan(20);
      expect(blocker.endsWith(".")).toBe(true);
    }
  });
});
