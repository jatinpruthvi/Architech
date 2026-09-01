/* Comparable homes from the same locality, ordered by price proximity.
   Kept out of `history.ts` so listing-page client code can derive a price
   story without pulling the nationwide inventory into the first-load bundle. */
import { getListingsByLocality } from "@/lib/repositories/listings";
import type { ComparableListing } from "./history";

export function comparableListings(subject: { id: string; localitySlug: string; priceNum: number }, limit = 3): ComparableListing[] {
  const peers = getListingsByLocality(subject.localitySlug)
    .filter((listing) => listing.id !== subject.id && listing.priceNum > 0)
    .sort((a, b) => Math.abs(a.priceNum - subject.priceNum) - Math.abs(b.priceNum - subject.priceNum))
    .slice(0, limit);
  return peers.map((listing) => ({
    id: listing.id,
    title: listing.title,
    priceNum: listing.priceNum,
    locality: listing.locality,
    areaNum: listing.areaNum,
    pricePerSqft: listing.pricePerSqft,
    badge: listing.badge,
    deltaPct: Math.round(((listing.priceNum - subject.priceNum) / subject.priceNum) * 100),
  }));
}
