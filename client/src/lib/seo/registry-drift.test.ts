/* SEO surface snapshot-drift tests (P1-SEO-002).

   The public page inventory is a promise: which pages exist, which intents
   they own, which sitemap segment carries them, and at what priority. Silent
   drift in any of that — a registry edit, a repository change, a quality-gate
   tweak — should fail loudly here instead of shipping unnoticed to Google.

   Mechanism: a committed expected artifact (snapshots/seo-registry.snapshot.txt)
   compared by toMatchFileSnapshot. Update it deliberately with
   `npx vitest run registry-drift -u` and review the diff like any code change. */

import { describe, expect, it } from "vitest";
import path from "node:path";
import { getIndexableSeoPages, getPublishableSeoPages, seoPages, sitemapSegmentForPage } from "./pages";
import { SITE_URL } from "./urls";

const SNAPSHOT = path.resolve(__dirname, "snapshots", "seo-registry.snapshot.txt");

/** Strip the deployment origin so the snapshot is environment-independent:
    a preview deploy with a different NEXT_PUBLIC_SITE_URL must not drift. */
function stripOrigin(url: string): string {
  return url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) : url;
}

function registryLines(): string[] {
  const lines: string[] = [];
  const sorted = [...seoPages].sort((a, b) => a.path.localeCompare(b.path));
  for (const page of sorted) {
    lines.push(
      [
        page.id,
        page.routeType,
        page.path,
        page.indexability,
        sitemapSegmentForPage(page),
        page.qualityState,
        page.owner,
        page.sitemap.changeFrequency,
        String(page.sitemap.priority),
        page.lastModified ?? "-",
        `entities=${page.entityIds.join("+") || "-"}`,
      ].join(" | "),
    );
  }
  return lines;
}

function segmentSummary(): string {
  const indexable = getIndexableSeoPages();
  const publishable = getPublishableSeoPages ? getPublishableSeoPages() : indexable;
  const counts = new Map<string, number>();
  for (const page of indexable) {
    const segment = sitemapSegmentForPage(page);
    counts.set(segment, (counts.get(segment) ?? 0) + 1);
  }
  const header = `pages total=${seoPages.length} indexable=${indexable.length} publishable=${publishable.length}`;
  const rows = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([segment, n]) => `${segment}: ${n}`);
  return [header, ...rows].join("\n");
}

describe("SEO registry snapshot drift", () => {
  it("keeps the public page inventory byte-stable", async () => {
    const body = ["# Architech SEO registry snapshot", "", ...registryLines()].join("\n") + "\n";
    await expect(body).toMatchFileSnapshot(SNAPSHOT);
  });

  it("keeps sitemap segmentation stable", () => {
    const summary = segmentSummary();
    expect(summary).toContain("pages total=");
    /* Segment-level assertions: cheap invariants that fail even when a
       reviewable snapshot update was rubber-stamped by accident. */
    expect(summary).toMatch(/cities: 1[2-9]\d*/); // currently 12 cities
    expect(summary).toMatch(/localities: [5-9]\d/); // currently 72
  });

  it("every indexable page follows the URL grammar and declares an intent", () => {
    for (const page of getIndexableSeoPages()) {
      /* Trailing slash is the rule; the only sanctioned exception is the
         file-style convention for machine enumerations (/sitemap.html). */
      const fileStyle = /\.(html|xml)$/.test(page.path);
      expect(page.path.endsWith("/") || fileStyle, page.id).toBe(true);
      expect(page.primaryIntent.length, page.id).toBeGreaterThan(0);
      expect(stripOrigin(page.canonicalUrl).startsWith("/"), page.id).toBe(true);
    }
  });

  it("never admits interactive-only surfaces into the indexable registry", () => {
    const paths = new Set(seoPages.map((p) => p.path));
    for (const banned of ["/search/", "/saved/", "/compare/", "/admin/", "/broker/"]) {
      expect(paths.has(banned), banned).toBe(false);
    }
  });
});
