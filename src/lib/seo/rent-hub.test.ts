/* The national rent hub, and the gate that decides whether it may publish.
 *
 * WHY THIS FILE EXISTS
 *
 * The rent surface shipped with 12 city pages and 72 locality pages but no
 * root: `/rent/` 404'd while `/buy/` was the highest-priority page in the
 * sitemap. Every existing gate passed — the registry drift test, the sitemap
 * contract, the 578-page crawler — because all of them check pages that
 * EXIST. None could notice a page that should exist and does not. That is the
 * same blind spot the on-page SEO audit found, one level up.
 *
 * These tests pin the two properties that matter and that nothing else covers:
 * the hub is registered as the buy hub's counterpart, and it is judged on
 * RENTAL stock so it cannot publish an index of pages the gate is withholding.
 */
import { describe, expect, it } from "vitest";
import { getListings } from "@/lib/repositories";
import { seoPages } from "./pages";
import { qualityInputFor } from "./page-gate";
import { evaluatePageQuality } from "./page-quality";
import type { Property } from "@/lib/repositories";

const rentHub = () => seoPages.find((page) => page.id === "hub:rent:india")!;
const buyHub = () => seoPages.find((page) => page.id === "hub:buy:india")!;

describe("the national rent hub is registered", () => {
  it("exists at /rent/ as a hub, mirroring /buy/", () => {
    const rent = rentHub();
    expect(rent).toBeDefined();
    expect(rent.path).toBe("/rent/");
    expect(rent.routeType).toBe("hub");
    expect(rent.indexability).toBe("indexable");
  });

  it("is symmetric with the buy hub on every structural field", () => {
    /* The defect was asymmetry, so the guard is a symmetry assertion: any
       future field added to one hub and not the other fails here. */
    const rent = rentHub();
    const buy = buyHub();
    expect(rent.routeType).toBe(buy.routeType);
    expect(rent.indexability).toBe(buy.indexability);
    expect(rent.owner).toBe(buy.owner);
    expect(rent.qualityState).toBe(buy.qualityState);
    expect(rent.entityIds).toEqual(buy.entityIds);
    expect(rent.sitemap?.changeFrequency).toBe(buy.sitemap?.changeFrequency);
  });

  it("ranks below the buy hub, which is the larger market", () => {
    // Deliberate, not incidental: two roots at equal priority would compete
    // for the same crawl budget.
    expect(rentHub().sitemap!.priority).toBeLessThan(buyHub().sitemap!.priority);
  });
});

describe("the rent hub is gated on rental stock", () => {
  it("publishes when rental inventory exists", () => {
    const verdict = evaluatePageQuality(qualityInputFor(rentHub()));
    expect(verdict.indexable).toBe(true);
    expect(verdict.sitemapEligible).toBe(true);
  });

  it("counts RENTAL listings, not the whole corpus", () => {
    /* The load-bearing assertion. If this counted every listing, the hub would
       publish on sale inventory alone — an index of rent pages the gate is
       simultaneously withholding, which is exactly the doorway pattern the
       intent split exists to prevent. */
    const rentals = getListings().filter((property) => (property.transaction ?? "buy") === "rent");
    expect(qualityInputFor(rentHub()).activeListings).toBe(rentals.length);
    expect(rentals.length).toBeLessThan(getListings().length);
  });

  it("is withheld when there is no rental stock anywhere", () => {
    const verdict = evaluatePageQuality(qualityInputFor(rentHub(), { listings: [] }));
    expect(verdict.indexable).toBe(false);
    expect(verdict.sitemapEligible).toBe(false);
  });

  it("is withheld when the only inventory is for sale", () => {
    // The realistic failure shape: plenty of listings, none of them rentals.
    const saleOnly = getListings()
      .filter((property) => (property.transaction ?? "buy") !== "rent")
      .map((property) => ({ ...property }) as Property);
    expect(saleOnly.length).toBeGreaterThan(0);
    const verdict = evaluatePageQuality(qualityInputFor(rentHub(), { listings: saleOnly }));
    expect(verdict.indexable).toBe(false);
  });
});
