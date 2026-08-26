/* Listing price history & comparable sales (P1-DATA-006).
   Deterministic, server-safe domain model that derives a listing's price story
   from an explicit event list (price set / change), and surfaces comparable
   homes from the same locality by price proximity. Never invents a price —
   history is only shown when events exist, and comparables are derived from
   live listing facts. */

import { getListingsByLocality } from "@/lib/repositories";

export type PriceEventKind = "listed" | "price_change" | "sold";

export type PriceEvent = {
  id: string;
  kind: PriceEventKind;
  priceInr: number;
  date: string;
  note?: string;
};

export type PriceHistory = {
  listingId: string;
  currency: "INR";
  events: PriceEvent[]; // newest first
  currentPriceInr: number | null;
  hasDecline: boolean;
};

export type ComparableListing = {
  id: string;
  title: string;
  priceNum: number;
  locality: string;
  areaNum?: number;
  pricePerSqft?: string;
  badge: string;
  /** Percentage difference vs the subject listing's current price. */
  deltaPct: number;
};

export function sortPriceEvents(events: PriceEvent[]): PriceEvent[] {
  return [...events].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.priceInr - a.priceInr;
  });
}

/** Derive the current price (latest event) and whether price has decreased. */
export function derivePriceHistory(listingId: string, events: PriceEvent[]): PriceHistory {
  const sorted = sortPriceEvents(events);
  const current = sorted[0]?.priceInr ?? null;
  // Sorted newest-first: a decline means some newer event is below its
  // immediately older predecessor.
  const hasDecline = sorted.some((event, index) => index + 1 < sorted.length && event.priceInr < sorted[index + 1].priceInr);
  return { listingId, currency: "INR", events: sorted, currentPriceInr: current, hasDecline };
}

/** Comparable homes from the same locality, ordered by price proximity. */
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
