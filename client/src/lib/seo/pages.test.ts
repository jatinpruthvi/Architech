import { describe, expect, it } from "vitest";
import { getGuides, getListings, getLocalities } from "@/lib/repositories";
import { getIndexableSeoPages, seoPages } from "./pages";
import { savedPath, searchPath } from "./urls";

describe("SeoPage registry", () => {
  it("registers the current indexable public page set", () => {
    const expectedCount = 1 + 1 + getLocalities().length + getListings().length + 1 + getGuides().length;
    expect(seoPages).toHaveLength(expectedCount);
    expect(seoPages.map((page) => page.routeType)).toContain("home");
    expect(seoPages.filter((page) => page.routeType === "locality")).toHaveLength(getLocalities().length);
    expect(seoPages.filter((page) => page.routeType === "listing")).toHaveLength(getListings().length);
    expect(seoPages.filter((page) => page.routeType === "guide").length).toBe(1 + getGuides().length);
  });

  it("keeps registry IDs, paths, and canonicals unique", () => {
    const ids = new Set(seoPages.map((page) => page.id));
    const paths = new Set(seoPages.map((page) => page.path));
    const canonicals = new Set(seoPages.map((page) => page.canonicalUrl));
    expect(ids.size).toBe(seoPages.length);
    expect(paths.size).toBe(seoPages.length);
    expect(canonicals.size).toBe(seoPages.length);
  });

  it("only exposes absolute canonical URLs with route trailing slash policy", () => {
    for (const page of seoPages) {
      expect(page.canonicalUrl).toMatch(/^https:\/\//);
      expect(page.path.endsWith("/")).toBe(true);
      expect(new URL(page.canonicalUrl).pathname.endsWith("/")).toBe(true);
    }
  });

  it("excludes faceted and private app pages from the indexable registry", () => {
    const indexablePaths = getIndexableSeoPages().map((page) => page.path);
    expect(indexablePaths).not.toContain(searchPath());
    expect(indexablePaths).not.toContain(savedPath());
    for (const guide of getGuides().filter((item) => item.status !== "published")) expect(indexablePaths).not.toContain(guide.path);
    expect(getIndexableSeoPages().every((page) => page.indexability === "indexable")).toBe(true);
  });

  it("carries ownership, intent, quality, freshness, entity, and sitemap metadata", () => {
    for (const page of seoPages) {
      expect(page.primaryIntent.length).toBeGreaterThan(10);
      expect(page.owner).toMatch(/^(Product|SEO|Content)$/);
      expect(page.qualityState).toMatch(/^(prototype-validated|needs-production-data|editorial-review-required)$/);
      expect(page.freshnessPolicy.length).toBeGreaterThan(10);
      expect(page.entityIds.length).toBeGreaterThan(0);
      expect(page.sitemap.priority).toBeGreaterThan(0);
      expect(page.sitemap.priority).toBeLessThanOrEqual(1);
    }
  });
});
