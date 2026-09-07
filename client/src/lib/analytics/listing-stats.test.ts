import { beforeEach, describe, expect, it } from "vitest";
import {
  getListingStats,
  listAllListingStats,
  recordListingMetric,
  resetListingStatsForTests,
} from "./listing-stats";

/* BUG-R4-007: `statsByListing` and `seenViews` had no ceiling on the NUMBER of
   entries, and both are keyed by attacker-controlled input:

     - `listingId` is the `[id]` URL path segment;
     - `sessionKey` is a request-body field, and when omitted it DEFAULTS to a
       random value, so even a client that sends nothing grows `seenViews`.

   The route (POST app/api/listings/[id]/stats/route.ts) is unauthenticated and
   — unlike leads, auth and observability — carries no `enforceMutationSafety`
   call. So rotating either key mints permanent entries in a long-lived
   process. Same class as BUG-R4-001 (metrics series), BUG-R4-002 (mutation
   buckets) and BUG-R4-003 (login throttle).

   These tests use only API that existed before the fix:
   `listAllListingStats().length` observes the Map, and the `duplicate` flag
   observes whether a `seenViews` key survived. */

beforeEach(() => {
  resetListingStatsForTests();
});

describe("listing-stats bounded state (BUG-R4-007)", () => {
  it("BUG-R4-007: the tracked-listing map stays bounded under rotating listing ids", () => {
    for (let i = 0; i < 20_000; i += 1) {
      recordListingMetric(`listing-${i}`, "saves");
    }
    // Pre-fix this returns 20000: one permanent entry per distinct id.
    expect(listAllListingStats().length).toBeLessThanOrEqual(5_000);
  });

  it("BUG-R4-007: the seen-views set stays bounded under rotating session keys", () => {
    const first = recordListingMetric("listing-a", "views", "session-a");
    expect(first.duplicate).toBe(false);

    // Flood with distinct session keys for one listing.
    for (let i = 0; i < 60_000; i += 1) {
      recordListingMetric("listing-a", "views", `flood-${i}`);
    }

    /* Post-fix the oldest key has been evicted, so this is no longer recognised
       as a duplicate. Pre-fix it is still remembered — proving the set grew
       without bound. */
    const replay = recordListingMetric("listing-a", "views", "session-a");
    expect(replay.duplicate).toBe(false);
  });

  it("BUG-R4-007: omitting sessionKey still cannot grow the set without bound", () => {
    for (let i = 0; i < 60_000; i += 1) {
      // The default sessionKey is random, so every call adds a new key.
      recordListingMetric("listing-b", "views");
    }
    expect(listAllListingStats().length).toBeLessThanOrEqual(5_000);
  });

  it("still de-duplicates a repeated view inside the bound", () => {
    expect(recordListingMetric("listing-c", "views", "same").duplicate).toBe(false);
    expect(recordListingMetric("listing-c", "views", "same").duplicate).toBe(true);
  });

  it("still counts each metric and returns current stats", () => {
    recordListingMetric("listing-d", "views", "s1");
    recordListingMetric("listing-d", "saves", "s1");
    recordListingMetric("listing-d", "inquiries", "s1");
    expect(getListingStats("listing-d")).toMatchObject({ views: 1, saves: 1, inquiries: 1 });
  });

  it("returns zeroed stats for an unknown listing", () => {
    expect(getListingStats("never-seen")).toMatchObject({ views: 0, saves: 0, inquiries: 0 });
  });
});
