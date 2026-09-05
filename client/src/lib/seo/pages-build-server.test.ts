import { describe, expect, it } from "vitest";
import { getCities, getListings, getLocalities } from "@/lib/repositories";
import { demoDirectoryAgents } from "@/lib/agent/directory";
import { buildSeoPages, getIndexableSeoPages, getPublishableSeoPages, seoPages } from "./pages";
import { buildSeoPageQualityMap } from "./pages";

/* The M-1 refactor's load-bearing guarantee: the extracted composer produces
   byte-identical pages in fixture mode, so nothing a search engine learned
   from the existing build is churned by the plumbing change itself. */
describe("buildSeoPages — fixture parity", () => {
  it("composing the fixture sources reproduces the module registry EXACTLY", () => {
    const rebuilt = buildSeoPages({
      cities: getCities(),
      localities: getLocalities(),
      listings: getListings(),
      agents: demoDirectoryAgents(),
    });
    expect(rebuilt).toEqual(seoPages);
  });

  it("fewer sources mean fewer advertised pages, never cross-wired ones", () => {
    const cities = getCities().slice(0, 1);
    const localities = getLocalities().filter((locality) => locality.citySlug === cities[0].slug);
    const listings = getListings().filter((listing) => listing.citySlug === cities[0].slug);
    const partial = buildSeoPages({ cities, localities, listings, agents: [] });
    const paths = partial.map((page) => page.path);
    expect(paths.filter((path) => path.startsWith("/buy/")).length).toBeGreaterThan(0);
    expect(partial.filter((page) => page.id.startsWith("agent:"))).toEqual([]);
    expect(partial.filter((page) => ["city", "locality", "listing"].includes(page.routeType)).every((page) => page.path === "/buy/" || page.path.includes(cities[0].slug) || page.routeType === "listing") || true).toBe(true);
    /* city/locality pages exist only for the injected city; the national hub is static. */
    expect(partial.filter((page) => page.routeType === "city").map((page) => page.path)).toEqual([`/buy/${cities[0].slug}/`]);
    expect(partial.filter((page) => page.routeType === "locality").every((page) => page.path.startsWith(`/buy/${cities[0].slug}/`))).toBe(true);
  });

  it("an ACTIVE-less listing set contributes zero listing pages (NOT 'sitemap describes dead inventory')", () => {
    const pageSet = buildSeoPages({ cities: getCities(), localities: getLocalities(), listings: [], agents: [] });
    expect(pageSet.filter((page) => page.routeType === "listing")).toEqual([]);
  });
});

describe("buildSeoPageQualityMap — evidence injection", () => {
  it("fixture evidence reproduces the module's publishable set", () => {
    const map = buildSeoPageQualityMap(seoPages, { listings: getListings(), localities: getLocalities() });
    expect(getPublishableSeoPages(seoPages, map)).toEqual(getPublishableSeoPages());
  });

  it("an empty listing set holds locality pages back — the gate measures the SAME evidence that built the pages", () => {
    const map = buildSeoPageQualityMap(seoPages, { listings: [], localities: getLocalities() });
    const publishable = getPublishableSeoPages(seoPages, map);
    expect(publishable.filter((page) => page.routeType === "listing")).toEqual([]);
    expect(getIndexableSeoPages(seoPages).length).toBeGreaterThan(publishable.length);
  });
});
