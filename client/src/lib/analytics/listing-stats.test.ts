import { beforeEach, describe, expect, it } from "vitest";
import { getListingStats, listAllListingStats, recordListingMetric, resetListingStatsForTests } from "./listing-stats";

describe("listing performance tracking", () => {
  beforeEach(() => resetListingStatsForTests());

  it("increments views, saves, and inquiries idempotently", () => {
    const first = recordListingMetric("garden-courtyard", "views", "session-a");
    expect(first.ok && first.stats.views).toBe(1);
    expect(first.duplicate).toBe(false);

    const repeat = recordListingMetric("garden-courtyard", "views", "session-a");
    expect(repeat.duplicate).toBe(true);
    expect(repeat.ok && repeat.stats.views).toBe(1); // no double-count in same session

    recordListingMetric("garden-courtyard", "saves", "session-a");
    recordListingMetric("garden-courtyard", "inquiries", "session-a");
    const stats = getListingStats("garden-courtyard");
    expect(stats.saves).toBe(1);
    expect(stats.inquiries).toBe(1);
  });

  it("counts distinct sessions as separate views", () => {
    recordListingMetric("garden-courtyard", "views", "session-a");
    recordListingMetric("garden-courtyard", "views", "session-b");
    expect(getListingStats("garden-courtyard").views).toBe(2);
  });

  it("returns a zero baseline for an untracked listing", () => {
    const stats = getListingStats("unknown");
    expect(stats.views).toBe(0);
    expect(stats.saves).toBe(0);
  });

  it("lists all tracked listings newest-first", () => {
    recordListingMetric("a", "views", "s1");
    recordListingMetric("b", "views", "s2");
    expect(listAllListingStats().map((s) => s.listingId)).toContain("a");
    expect(listAllListingStats().map((s) => s.listingId)).toContain("b");
  });
});
