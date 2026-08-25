/* Locality/city trust aggregation. Derives an area-level trust summary from the
   per-listing trust scores so the city and locality hubs surface verified
   coverage honestly. Server-safe: no client directive, no side effects. */
import { getListings, getListingsByLocality } from "@/lib/repositories";
import { badgesToTrustInput, computeTrustScore, type TrustGrade, type TrustSignalId } from "./score";

export type LocalityTrustSummary = {
  slug: string;
  name: string;
  total: number;
  reraVerified: number;
  verifiedPartner: number;
  sourceReviewed: number;
  reraCoveragePct: number;
  avgScore: number;
  grade: TrustGrade;
};

function trustForListings(slug: string, name: string, listings: ReturnType<typeof getListings>): LocalityTrustSummary {
  const scores = listings.map((listing) => computeTrustScore(badgesToTrustInput(listing.badge, listing.status)));
  const metCount = (id: TrustSignalId) => scores.filter((score) => score.signals.find((signal) => signal.id === id)?.met).length;
  const reraVerified = metCount("rera_verified");
  const verifiedPartner = metCount("broker_verified");
  const sourceReviewed = metCount("source_reviewed");
  const avgScore = scores.length ? Math.round(scores.reduce((total, score) => total + score.score, 0) / scores.length) : 0;
  const grade: TrustGrade = avgScore >= 78 ? "HIGH" : avgScore >= 52 ? "MEDIUM" : "LOW";
  return {
    slug,
    name,
    total: listings.length,
    reraVerified,
    verifiedPartner,
    sourceReviewed,
    reraCoveragePct: listings.length ? Math.round((reraVerified / listings.length) * 100) : 0,
    avgScore,
    grade,
  };
}

/** Trust summary across all homes in a locality. */
export function localityTrustSummary(slug: string): LocalityTrustSummary {
  const listings = getListingsByLocality(slug);
  return trustForListings(slug, listings[0]?.locality ?? slug, listings);
}

/** Trust summary across the whole city inventory. */
export function cityTrustSummary(): LocalityTrustSummary {
  return trustForListings("ahmedabad", "Ahmedabad", getListings());
}
