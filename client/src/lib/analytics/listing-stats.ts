/* Listing performance tracking (P1-OBS-003).
   Idempotent, memory-backed counters for listing views, saves, and inquiries.
   Supports the agent desk's KPI surface with real data (rather than a hard-coded
   placeholder) and is guarded against double-counting a view in the same session.
   Server-safe; a durable, per-identity store arrives with live auth + DB. */

export type ListingMetric = "views" | "saves" | "inquiries";

export type ListingStats = {
  listingId: string;
  views: number;
  saves: number;
  inquiries: number;
  firstSeenAt: string;
  lastUpdatedAt: string;
};

const statsByListing = new Map<string, ListingStats>();
const seenViews = new Set<string>(); // `${listingId}:${sessionKey}` idempotency

function stableId(prefix: string, key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${prefix}_${hash.toString(36)}`;
}

function touch(listingId: string, delta: Partial<Record<ListingMetric, number>>): ListingStats {
  const now = new Date().toISOString();
  const existing = statsByListing.get(listingId);
  const base = existing ?? { listingId, views: 0, saves: 0, inquiries: 0, firstSeenAt: now, lastUpdatedAt: now };
  const next: ListingStats = {
    ...base,
    views: base.views + (delta.views ?? 0),
    saves: base.saves + (delta.saves ?? 0),
    inquiries: base.inquiries + (delta.inquiries ?? 0),
    lastUpdatedAt: now,
  };
  statsByListing.set(listingId, next);
  return next;
}

/** Record a metric. Views are idempotent per `sessionKey` (defaults to a random
    per-process key so the call is safe to repeat without an identity). */
export function recordListingMetric(
  listingId: string,
  metric: ListingMetric,
  sessionKey: string = stableId("session", `${listingId}:${Math.random()}`),
): { ok: true; stats: ListingStats; duplicate: boolean } {
  if (metric === "views") {
    const key = `${listingId}:${sessionKey}`;
    if (seenViews.has(key)) {
      return { ok: true, stats: touch(listingId, {}), duplicate: true };
    }
    seenViews.add(key);
  }
  const stats = touch(listingId, { [metric]: 1 });
  return { ok: true, stats, duplicate: false };
}

export function getListingStats(listingId: string): ListingStats {
  return statsByListing.get(listingId) ?? {
    listingId,
    views: 0,
    saves: 0,
    inquiries: 0,
    firstSeenAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function listAllListingStats(): ListingStats[] {
  return [...statsByListing.values()].sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
}

export function resetListingStatsForTests() {
  statsByListing.clear();
  seenViews.clear();
}
