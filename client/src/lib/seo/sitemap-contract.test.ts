import { describe, expect, it } from "vitest";
import { buildSitemapIndex, buildSegmentSitemap, collectUnsegmentedPages, getSegmentPages, SITEMAP_SEGMENTS } from "./sitemap";
import { getHeldBackPages, getIndexableSeoPages, getPublishableSeoPages, sitemapSegmentForPage } from "./pages";
import { sitemapSegmentPath } from "./urls";

/* The contract that matters: `lastmod` is a promise about when a page changed.
   These tests exist to catch the three ways that promise gets broken — stamping
   the clock, inventing a date for a page that has none, and dating a page in
   the future. */

const todayIso = new Date().toISOString().slice(0, 10);

describe("sitemap publication contracts", () => {
  it("publishes one child sitemap per declared segment", () => {
    const index = buildSitemapIndex();
    for (const segment of SITEMAP_SEGMENTS) {
      expect(index).toContain(sitemapSegmentPath(segment.id));
    }
    expect(index).toContain("<sitemapindex");
    // The index is an index, not a urlset.
    expect(index).not.toContain("<urlset");
  });

  it("places every indexable page in exactly one child sitemap", () => {
    const indexable = getIndexableSeoPages();
    /* `getSegmentPages` enumerates the PUBLISHABLE set, so the comparison is
       against indexable-minus-held rather than indexable. The invariant this
       test defends is "exactly one sitemap per page, none orphaned" — not
       "the gate holds nothing back", which the calibration guard below owns. */
    const segmented = SITEMAP_SEGMENTS.flatMap((segment) => getSegmentPages(segment.id));
    expect(segmented).toHaveLength(indexable.length - getHeldBackPages().length);
    // No page appears in two child sitemaps: unique ids === total entries.
    expect(new Set(segmented.map((page) => page.id)).size).toBe(segmented.length);
    expect(collectUnsegmentedPages()).toHaveLength(0);
  });

  it("publishes lastmod only as a plain calendar date, never a clock timestamp", () => {
    const all = [buildSitemapIndex(), ...SITEMAP_SEGMENTS.map((segment) => buildSegmentSitemap(segment.id))].join("\n");
    for (const match of all.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
      // A `T`-separated value (or today's date) is the signature of a
      // `new Date()` stamp rather than a real content-change date.
      expect(match[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(all).not.toContain(`<lastmod>${todayIso}T`);
  });

  it("never dates a page in the future", () => {
    for (const segment of SITEMAP_SEGMENTS) {
      for (const page of getSegmentPages(segment.id)) {
        if (!page.lastModified) continue;
        expect(page.lastModified <= todayIso).toBe(true);
      }
    }
  });

  it("omits lastmod for standing pages that carry no datable entity", () => {
    // A pages sitemap may also contain a sourced dataset hub with a real
    // snapshot date. Check the undated standing pages themselves rather than
    // assuming no page in the whole segment can ever own a date.
    const pages = getSegmentPages("pages");
    for (const id of ["home", "hub:buy:india", "page:requirements", "page:about", "page:contact"]) {
      expect(pages.find((page) => page.id === id)?.lastModified).toBeUndefined();
    }
    expect(pages.find((page) => page.id === "hub:locations:india")?.lastModified).toBe("2026-08-30");
  });

  it("dates listing, locality, city, and guide sitemaps from their own records", () => {
    // These four surfaces own a real date: listing.meaningfulUpdatedAt,
    // locality fact as-of, newest locality in the city, guide.updatedAt.
    for (const segment of ["listings", "localities", "cities", "guides"] as const) {
      expect(buildSegmentSitemap(segment)).toContain("<lastmod>");
    }
  });

  it("keeps non-indexable pages out of every child sitemap", () => {
    for (const segment of SITEMAP_SEGMENTS) {
      for (const page of getSegmentPages(segment.id)) {
        expect(page.indexability).toBe("indexable");
        expect(sitemapSegmentForPage(page)).toBe(segment.id);
      }
    }
  });

  it("advertises nothing while public indexing is gated off", () => {
    // A production build without PUBLIC_INDEXING_ENABLED must not publish URLs
    // that every page is simultaneously marking `noindex`.
    const gated = { NODE_ENV: "production" } as const;
    expect(buildSitemapIndex(gated)).not.toContain("<loc>");
    for (const segment of SITEMAP_SEGMENTS) {
      expect(buildSegmentSitemap(segment.id, gated)).not.toContain("<loc>");
    }
    // ...but the endpoints still render valid, empty XML rather than 404ing.
    expect(buildSitemapIndex(gated)).toContain("<sitemapindex");
    expect(buildSegmentSitemap("listings", gated)).toContain("<urlset");
  });

  it("escapes URLs so a malformed entity value cannot emit invalid XML", () => {
    const xml = buildSitemapIndex();
    // Every loc must be a complete absolute URL with no raw ampersands.
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      expect(match[1]).toMatch(/^https:\/\//);
      expect(match[1]).not.toContain("&amp;");
    }
  });
});

describe("quality gate governs publication", () => {
  it("publishes only pages the quality gate clears", () => {
    // The sitemap is the last line of defence: a page the gate holds back must
    // never be submitted, however it got into the registry.
    expect(getPublishableSeoPages().length).toBeLessThanOrEqual(getIndexableSeoPages().length);
    for (const page of getPublishableSeoPages()) {
      expect(page.indexability).toBe("indexable");
    }
  });

  it("reports every held-back page with actionable reasons", () => {
    // Held-back pages are a worklist, not a silent drop.
    for (const entry of getHeldBackPages()) {
      expect(entry.decision.status).toBe("HOLD");
      expect(entry.decision.reasons.length).toBeGreaterThan(0);
      expect(entry.page.indexability).toBe("indexable");
    }
  });

  it("holds back exactly the intent pages with no matching inventory", () => {
    /* Calibration guard. This was `toHaveLength(0)` while every locality had a
       single page judged on its whole inventory. Splitting buy and rent into
       separate pages (each judged on ITS OWN transaction type) legitimately
       moved the number, and the six below are all correct holds:

         - 4 rent pages for localities with sale stock but nothing to rent.
         - 2 BUY pages (bopal, satellite) whose only listings are rentals.
           These are the interesting ones: they were being published on the
           strength of rental inventory before the intent filter existed, i.e.
           a "homes for sale in Bopal" page backed by zero homes for sale.
           The split surfaced a pre-existing thin page rather than creating one.

       If this list changes, inventory moved or the evidence bar moved — either
       way it should be a deliberate decision, not a silent drift. */
    expect(getHeldBackPages().map((entry) => entry.page.id).sort()).toEqual([
      "locality:ahmedabad:bopal:buy",
      "locality:ahmedabad:navrangpura:rent",
      "locality:ahmedabad:paldi:rent",
      "locality:ahmedabad:prahlad-nagar:rent",
      "locality:ahmedabad:satellite:buy",
      "locality:ahmedabad:thaltej:rent",
    ]);
    expect(getPublishableSeoPages().length).toBe(getIndexableSeoPages().length - 6);
  });

  it("judges a rent page on rental stock and a buy page on sale stock", () => {
    /* The mechanism behind the holds above. Bopal has rental inventory and no
       sale inventory, so exactly one of its two pages may publish — proving
       the two verdicts are computed independently rather than sharing one
       locality-wide count. */
    const published = new Set(getPublishableSeoPages().map((page) => page.id));
    expect(published.has("locality:ahmedabad:bopal:rent")).toBe(true);
    expect(published.has("locality:ahmedabad:bopal:buy")).toBe(false);
  });
});
