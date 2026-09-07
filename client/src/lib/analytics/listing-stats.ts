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

/* BUG-R4-007: hard ceilings on the NUMBER of entries in each container.

   Both are keyed by attacker-controlled input — `listingId` is the `[id]` URL
   path segment and `sessionKey` is a request-body field that defaults to a
   RANDOM value when omitted, so even a client sending nothing grows
   `seenViews`. The route (POST /api/listings/[id]/stats) is unauthenticated
   and, unlike leads/auth/observability, has no `enforceMutationSafety` call, so
   rotating either key minted permanent entries in a long-lived process.

   Fourth instance of the same class as BUG-R4-001/002/003. Eviction walks
   insertion order rather than sorting, for the reason documented in
   utils/bounded-window-map.ts: a sort here would run on every request once the
   ceiling is reached and become its own denial-of-service amplifier. */
export const MAX_TRACKED_LISTINGS = 5_000;
export const MAX_SEEN_VIEW_KEYS = 50_000;

const statsByListing = new Map<string, ListingStats>();
const seenViews = new Set<string>(); // `${listingId}:${sessionKey}` idempotency

/** Live container sizes. Exposed for the bound's regression test and for ops. */
export function listingStatsStoreCounts(): { listings: number; seenViewKeys: number } {
  return { listings: statsByListing.size, seenViewKeys: seenViews.size };
}

function evictOldestEntries(set: { size: number; delete(key: string): unknown }, keys: Iterable<string>, limit: number): void {
  for (const key of keys) {
    if (set.size <= limit) break;
    set.delete(key);
  }
}

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
  /* BUG-R4-007: only a brand-new listing id can grow the map, so evict only
     then — an update to a tracked listing reuses its slot. */
  if (!existing && statsByListing.size >= MAX_TRACKED_LISTINGS - 1) {
    evictOldestEntries(statsByListing, statsByListing.keys(), MAX_TRACKED_LISTINGS - 1);
  }
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
    /* BUG-R4-007: bounded idempotency window. Dropping the oldest keys means a
       very old replayed view may be counted twice; unbounded growth means the
       process eventually dies. That trade is deliberate and matches the rate
       limiters. */
    if (seenViews.size >= MAX_SEEN_VIEW_KEYS - 1) {
      evictOldestEntries(seenViews, seenViews.keys(), MAX_SEEN_VIEW_KEYS - 1);
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
