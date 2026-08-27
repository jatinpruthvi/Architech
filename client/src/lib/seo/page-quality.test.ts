import { describe, expect, it } from "vitest";
import { evaluatePageQuality, qualityRobots } from "./page-quality";

const base = {
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
    expect(decision.reasons).toContain("The page does not meet the verified evidence threshold.");
    expect(qualityRobots(decision)).toEqual({ index: false, follow: true });
  });

  it("requires real approval, source metadata, canonical ownership, and parent links", () => {
    const decision = evaluatePageQuality({ ...base, approved: false, hasSourceAndUpdate: false, hasCanonical: false, hasParentLink: false, hasUniqueData: false });
    expect(decision.status).toBe("HOLD");
    expect(decision.reasons.length).toBeGreaterThan(3);
  });
});
