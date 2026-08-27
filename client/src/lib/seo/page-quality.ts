export type PageQualityInput = {
  approved: boolean;
  activeListings: number;
  verifiedTransactions: number;
  uniqueWordCount: number;
  hasUniqueData: boolean;
  hasMethodology: boolean;
  hasSourceAndUpdate: boolean;
  hasCanonical: boolean;
  hasParentLink: boolean;
};

export type PageQualityDecision = {
  status: "INDEX" | "HOLD";
  reasons: string[];
  indexable: boolean;
  sitemapEligible: boolean;
};

/**
 * A page may enter the public index only after editorial approval, stable URL
 * ownership, useful evidence, and a meaningful data threshold. This prevents
 * doorway-page and index-bloat patterns without blocking useful noindex pages.
 */
export function evaluatePageQuality(input: PageQualityInput): PageQualityDecision {
  const reasons: string[] = [];
  if (!input.approved) reasons.push("Editorial approval is required.");
  if (!input.hasCanonical) reasons.push("A stable canonical URL is required.");
  if (!input.hasParentLink) reasons.push("The page must link to its parent hub.");
  if (!input.hasUniqueData || !input.hasMethodology) reasons.push("Distinct data and methodology are required.");
  if (!input.hasSourceAndUpdate) reasons.push("Source and meaningful update metadata are required.");
  const evidenceThreshold = input.activeListings >= 6 || input.verifiedTransactions >= 1 || input.uniqueWordCount >= 300;
  if (!evidenceThreshold) reasons.push("The page does not meet the verified evidence threshold.");
  const indexable = reasons.length === 0;
  return { status: indexable ? "INDEX" : "HOLD", reasons, indexable, sitemapEligible: indexable };
}

export function qualityRobots(decision: PageQualityDecision): { index: boolean; follow: boolean } {
  return { index: decision.indexable, follow: true };
}
