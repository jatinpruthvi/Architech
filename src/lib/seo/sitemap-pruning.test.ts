import { describe, expect, it } from "vitest";
import { sitemapActionForLifecycle, type ListingLifecycle } from "./lifecycle";
import { buildSegmentSitemap, getSegmentPages, pruneLifecycleExpiredPages } from "./sitemap";
import type { SeoPage } from "./pages";

/* Sitemap pruning rules for lifecycle-expired URLs (P1-SEO-003 remaining
   acceptance, previously "deferred, documented in the lifecycle module").

   The indexability gate already keeps non-ACTIVE listing pages out of the
   *registry's* publishable set, but a sitemap is a submission to Google — it
   is the last line of defence, so it gets its own lifecycle rule rather than
   trusting an earlier filter. A listing that 404s/410s/301s (DRAFT, IN_REVIEW,
   SOLD-for-context, EXPIRED, REMOVED, DUPLICATE, ARCHIVED) must never be
   advertised, even if it somehow reached the registry as indexable. */

function listingPage(id: string, lifecycle: ListingLifecycle, indexability: "indexable" | "noindex" = "indexable"): SeoPage {
  return {
    id: `listing:${id}`,
    routeType: "listing",
    path: `/listing/${id}/`,
    canonicalUrl: `https://architech-demo.example.com/listing/${id}/`,
    primaryIntent: "Test listing.",
    indexability,
    owner: "SEO",
    qualityState: "prototype-validated",
    freshnessPolicy: "n/a",
    entityIds: [],
    lifecycle,
    sitemap: { changeFrequency: "daily", priority: 0.7 },
  };
}

const INDEXED_ENV = { PUBLIC_INDEXING_ENABLED: "true" } as const;

describe("sitemap lifecycle pruning rule", () => {
  it("keeps only ACTIVE listings in the sitemap; every other lifecycle prunes", () => {
    expect(sitemapActionForLifecycle("ACTIVE")).toBe("keep");
    for (const lifecycle of ["DRAFT", "IN_REVIEW", "SOLD", "EXPIRED", "REMOVED", "DUPLICATE", "ARCHIVED"] as const) {
      expect(sitemapActionForLifecycle(lifecycle)).toBe("prune");
    }
  });

  it("prunes non-ACTIVE listing pages from the listings segment, keeping everything else", () => {
    const pages: SeoPage[] = [
      listingPage("active-home", "ACTIVE"),
      listingPage("expired-home", "EXPIRED"),
      listingPage("sold-home", "SOLD"),
      listingPage("duplicate-home", "DUPLICATE"),
      {
        // A non-listing page must never be pruned: the rule is listing-only.
        id: "locality:ahmedabad:paldi:buy",
        routeType: "locality",
        path: "/buy/ahmedabad/paldi/",
        canonicalUrl: "https://architech-demo.example.com/buy/ahmedabad/paldi/",
        primaryIntent: "Locality hub.",
        indexability: "indexable",
        owner: "SEO",
        qualityState: "prototype-validated",
        freshnessPolicy: "n/a",
        entityIds: [],
        sitemap: { changeFrequency: "daily", priority: 0.75 },
      },
    ];
    const kept = getSegmentPages("listings", pages).map((page) => page.id);
    expect(kept).toEqual(["listing:active-home"]);
    expect(pruneLifecycleExpiredPages(pages).map((page) => page.id)).toEqual([
      "listing:active-home",
      "locality:ahmedabad:paldi:buy",
    ]);
  });

  it("never emits an expired listing's URL even when the page is marked indexable", () => {
    /* Defense-in-depth: a regression that re-marked an EXPIRED listing
       indexable must still not submit its URL to Google. */
    const pages = [listingPage("expired-home", "EXPIRED", "indexable")];
    const xml = buildSegmentSitemap("listings", INDEXED_ENV, pages);
    expect(xml).not.toContain("listing/expired-home");
  });
});
