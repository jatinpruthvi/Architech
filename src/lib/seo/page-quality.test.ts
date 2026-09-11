import { describe, expect, it } from "vitest";
import { evaluatePageQuality, EVIDENCE_BAR, qualityRobots, type PageKind, type PageQualityInput } from "./page-quality";

const base: PageQualityInput = {
  pageKind: "programmatic",
  approved: true,
  activeListings: 6,
  verifiedTransactions: 0,
  uniqueWordCount: 220,
  hasUniqueData: true,
  hasMethodology: true,
  hasSourceAndUpdate: true,
  hasCanonical: true,
  hasParentLink: true,
};

describe("SEO page quality gate", () => {
  it("indexes approved pages with verified evidence", () => {
    const decision = evaluatePageQuality(base);
    expect(decision).toMatchObject({ status: "INDEX", indexable: true, sitemapEligible: true });
    expect(qualityRobots(decision)).toEqual({ index: true, follow: true });
  });

  it("holds thin pages out of the index and sitemap", () => {
    const decision = evaluatePageQuality({ ...base, activeListings: 2, uniqueWordCount: 120 });
    expect(decision.status).toBe("HOLD");
    expect(decision.sitemapEligible).toBe(false);
    expect(decision.reasons.some((reason) => reason.includes("evidence bar"))).toBe(true);
    expect(qualityRobots(decision)).toEqual({ index: false, follow: true });
  });

  it("requires real approval, source metadata, canonical ownership, and parent links", () => {
    const decision = evaluatePageQuality({ ...base, approved: false, hasSourceAndUpdate: false, hasCanonical: false, hasParentLink: false, hasUniqueData: false });
    expect(decision.status).toBe("HOLD");
    expect(decision.reasons.length).toBeGreaterThan(3);
  });

  it("reports every failed reason, not just the first", () => {
    const decision = evaluatePageQuality({
      ...base,
      approved: false,
      hasCanonical: false,
      hasParentLink: false,
      hasUniqueData: false,
      hasMethodology: false,
      hasSourceAndUpdate: false,
      activeListings: 0,
      verifiedTransactions: 0,
      uniqueWordCount: 0,
    });
    expect(decision.reasons).toHaveLength(6);
  });

  it("always allows following links, even when refusing to index", () => {
    expect(qualityRobots(evaluatePageQuality({ ...base, approved: false }))).toEqual({ index: false, follow: true });
  });

  it("declares an evidence bar for every page kind", () => {
    for (const kind of Object.keys(EVIDENCE_BAR) as PageKind[]) {
      expect(EVIDENCE_BAR[kind].label.length).toBeGreaterThan(10);
    }
  });
});

/* The calibration regression. A single flat `activeListings >= 6` bar would have
   marked all 72 locality pages non-indexable, because the real distribution is
   66 localities with 5 listings and 6 with 1. These tests exist so nobody
   "simplifies" the per-kind bar back into that. */
describe("locality evidence calibration", () => {
  const locality = (overrides: Partial<PageQualityInput> = {}): PageQualityInput => ({
    ...base,
    pageKind: "locality",
    activeListings: 5,
    ...overrides,
  });

  it("indexes a locality with five live listings and its own data", () => {
    expect(evaluatePageQuality(locality()).indexable).toBe(true);
  });

  it("indexes a locality with a single listing when the data is distinct", () => {
    expect(evaluatePageQuality(locality({ activeListings: 1 })).indexable).toBe(true);
  });

  it("holds a locality with no live listings", () => {
    // A place page with nothing in it is exactly the doorway pattern.
    const decision = evaluatePageQuality(locality({ activeListings: 0 }));
    expect(decision.indexable).toBe(false);
    expect(decision.reasons.some((reason) => reason.includes("locality evidence bar"))).toBe(true);
  });

  it("holds a locality with inventory but no distinct data of its own", () => {
    const decision = evaluatePageQuality(locality({ hasUniqueData: false }));
    expect(decision.indexable).toBe(false);
  });
});

describe("programmatic evidence bar stays strict", () => {
  it("rejects a generated page with five listings and no unique copy or data", () => {
    // Contestant C's generated `landmark × amenity` pages land here. Five
    // listings is not enough for a mass-generated surface.
    const decision = evaluatePageQuality({ ...base, pageKind: "programmatic", activeListings: 5, uniqueWordCount: 40 });
    expect(decision.indexable).toBe(false);
  });

  it("accepts a generated page that clears the strict bar", () => {
    expect(evaluatePageQuality({ ...base, pageKind: "programmatic", activeListings: 5, uniqueWordCount: 400 }).indexable).toBe(true);
    expect(evaluatePageQuality({ ...base, pageKind: "programmatic", activeListings: 5, verifiedTransactions: 1 }).indexable).toBe(true);
  });
});

describe("editorial evidence bar", () => {
  it("holds a guide with thin copy and no verified data", () => {
    const decision = evaluatePageQuality({ ...base, pageKind: "editorial", activeListings: 0, uniqueWordCount: 80 });
    expect(decision.indexable).toBe(false);
  });

  it("indexes a guide with substantive copy", () => {
    expect(evaluatePageQuality({ ...base, pageKind: "editorial", activeListings: 0, uniqueWordCount: 600 }).indexable).toBe(true);
  });
});

/* Contestant F §4: locality pages must not be "templates with the locality name
   swapped in". */
describe("locality distinct-data derivation", () => {
  it("holds a locality page whose record carries nothing of its own", () => {
    const decision = evaluatePageQuality({
      ...base,
      pageKind: "locality",
      activeListings: 3,
      hasUniqueData: false,
    });
    expect(decision.indexable).toBe(false);
    expect(decision.reasons.some((reason) => reason.includes("Distinct data"))).toBe(true);
  });

  it("still indexes a locality with real inventory once its data is confirmed", () => {
    expect(
      evaluatePageQuality({ ...base, pageKind: "locality", activeListings: 3, hasUniqueData: true }).indexable,
    ).toBe(true);
  });
});
