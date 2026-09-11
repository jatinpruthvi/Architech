/* Locality/city trust aggregation. Derives an area-level trust summary from the
   per-listing trust scores so the city and locality hubs surface verified
   coverage honestly. Server-safe: no client directive, no side effects. */
import { getCityBySlug, getListingsByCity, getListingsByLocality, getLocalityBySlug } from "@/lib/repositories";
import type { getListings } from "@/lib/repositories";
import { badgesToTrustInput, computeTrustScore, type TrustGrade, type TrustSignalId } from "./score";
import type { LocalityTrustSummary } from "./summary";

export type { LocalityTrustSummary } from "./summary";

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

/** Trust summary across all homes in a locality, scoped to its city. */
export function localityTrustSummary(slug: string, citySlug?: string): LocalityTrustSummary {
  const listings = getListingsByLocality(slug, citySlug);
  const name = listings[0]?.locality ?? getLocalityBySlug(slug, citySlug)?.name ?? slug;
  return trustForListings(slug, name, listings);
}

/** Trust summary across one city's inventory. */
export function cityTrustSummary(citySlug: string): LocalityTrustSummary {
  const city = getCityBySlug(citySlug);
  return trustForListings(citySlug, city?.name ?? citySlug, getListingsByCity(citySlug));
}
