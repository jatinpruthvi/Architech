import { describe, expect, it } from "vitest";
import { analyzeSearchConsoleSnapshot, buildSearchConsoleSetup, getIndexableCoverageSnapshot, indexedRatio } from "./monitoring";

describe("Search Console monitoring helpers", () => {
  it("calculates indexed ratio", () => {
    expect(indexedRatio({ date: "2026-08-24", submittedUrls: 10, indexedUrls: 8, excludedUrls: 2, clicks: 1, impressions: 10, sitemapErrors: 0, coverageErrors: 0 })).toBe(0.8);
  });

  it("raises alerts for index, sitemap, coverage, and click-drop issues", () => {
    const alerts = analyzeSearchConsoleSnapshot(
      { date: "2026-08-24", submittedUrls: 100, indexedUrls: 70, excludedUrls: 30, clicks: 50, impressions: 1000, sitemapErrors: 1, coverageErrors: 2 },
      { date: "2026-08-17", submittedUrls: 100, indexedUrls: 90, excludedUrls: 10, clicks: 120, impressions: 1000, sitemapErrors: 0, coverageErrors: 0 },
    );
    expect(alerts.map((alert) => alert.type)).toEqual(expect.arrayContaining(["index_coverage", "sitemap", "coverage_errors", "click_drop"]));
  });

  it("returns info alert when snapshot is healthy", () => {
    const alerts = analyzeSearchConsoleSnapshot({ date: "2026-08-24", submittedUrls: 100, indexedUrls: 95, excludedUrls: 5, clicks: 120, impressions: 1000, sitemapErrors: 0, coverageErrors: 0 });
    expect(alerts).toEqual([{ level: "info", type: "setup", message: "Search Console snapshot is within Phase 1 thresholds." }]);
  });

  it("builds setup checklist and coverage snapshot", () => {
    expect(buildSearchConsoleSetup("https://architech-demo.example.com")[0]).toContain("architech-demo.example.com");
    const coverage = getIndexableCoverageSnapshot();
    expect(coverage.indexablePageCount).toBeGreaterThan(1);
    expect(coverage.routeTypes.locality).toBeGreaterThan(0);
  });
});
