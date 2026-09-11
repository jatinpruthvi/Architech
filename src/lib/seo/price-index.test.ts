/* City property price index head (StudyArena round-12, contestant E §5).

   E calls a published, method-stated price index the one authority lever that
   cannot be faked: journalists cite numbers. The report already existed and
   was already gated — it simply could not be reached, because the only way to
   read it was a JSON API route. This module is the head of the public page.

   The assertion that matters is that the gate travels with it. The same rule
   that withholds a figure from the page must withhold the page from Google:
   a report that prints no numbers is exactly the thin page E §6 says to
   noindex, and a snippet that quotes a figure the page withholds is a lie
   told in a SERP. Both are asserted here against the real reports. */
import { describe, expect, it } from "vitest";
import { getCities } from "@/lib/repositories";
import { cityMarketTrends } from "@/lib/realestate/market-trends";
import { allCityMarketTrends, priceIndexHubJsonLd, priceIndexJsonLd, priceIndexMetadata, priceIndexOutboundLinks } from "./price-index";
import { isSerpTruncated, SERP_DESCRIPTION_MAX, SERP_TITLE_MAX } from "./serp";
import { cityPriceIndexUrl, priceIndexUrl } from "./urls";

const reports = allCityMarketTrends();
const publishable = reports.filter((report) => report.publishable);
const gated = reports.filter((report) => !report.publishable);

describe("price index head", () => {
  it("covers every city", () => {
    expect(reports.length).toBe(getCities().length);
  });

  /* The whole point of the page. If every city were gated the asset would be
     an empty index, and E's authority play would have nothing to publish. */
  it("has at least one city that clears the bar", () => {
    expect(publishable.length).toBeGreaterThan(0);
  });

  /* Withholding the figure and withholding the page are one decision. */
  it("indexes a city only when its report publishes figures", () => {
    for (const report of reports) {
      const robots = priceIndexMetadata(report).robots as { index: boolean; follow: boolean };
      expect(robots.index, report.citySlug).toBe(report.publishable);
      expect(robots.follow, report.citySlug).toBe(true);
    }
  });

  /* A snippet that quotes a median the page refuses to print would publish
     the number precisely where the gate was supposed to stop it. */
  it("never quotes a figure the page withholds", () => {
    for (const report of reports) {
      const description = String(priceIndexMetadata(report).description ?? "");
      const title = String(priceIndexMetadata(report).title ?? "");
      if (report.publishable) {
        expect(description, report.citySlug).toMatch(/median/i);
      } else {
        expect(description, report.citySlug).not.toMatch(/median[^,]*₹/i);
        expect(description, report.citySlug).toMatch(/withheld/i);
        expect(title, report.citySlug).not.toMatch(/₹/);
        /* The stated reason must be the report's real one. A city can clear
           the sample bar itself and still be withheld because no locality in
           it does — reporting the wrong reason would make the index less
           credible than publishing nothing. */
        expect(description, report.citySlug).toContain(report.blockers[0]!.replace(/\.$/, ""));
      }
    }
  });

  it("fits the SERP budget for every city, gated or not", () => {
    for (const report of reports) {
      const title = String(priceIndexMetadata(report).title);
      const description = String(priceIndexMetadata(report).description);
      expect(title.length + " · Architech".length, report.citySlug).toBeLessThanOrEqual(SERP_TITLE_MAX);
      expect(isSerpTruncated(title), report.citySlug).toBe(false);
      expect(description.length, report.citySlug).toBeLessThanOrEqual(SERP_DESCRIPTION_MAX);
      expect(isSerpTruncated(description), report.citySlug).toBe(false);
    }
  });

  it("canonises to its own URL, not the city hub it describes", () => {
    for (const report of reports) {
      expect(priceIndexMetadata(report).alternates?.canonical, report.citySlug).toBe(cityPriceIndexUrl(report.citySlug));
    }
  });

  it("emits Article plus BreadcrumbList and is serialisable", () => {
    for (const report of reports) {
      const graph = (priceIndexJsonLd(report) as { "@graph": Record<string, unknown>[] })["@graph"];
      expect(graph.map((node) => node["@type"]), report.citySlug).toEqual(["Article", "BreadcrumbList"]);
      const trail = graph[1]!["itemListElement"] as { position: number; item: string }[];
      expect(trail.map((crumb) => crumb.position), report.citySlug).toEqual([1, 2, 3]);
      expect(trail[0]!.item, report.citySlug).toMatch(/^https?:\/\//);
      expect(trail[2]!.item, report.citySlug).toBe(cityPriceIndexUrl(report.citySlug));
      expect(() => JSON.stringify(priceIndexJsonLd(report))).not.toThrow();
    }
  });

  /* The sample and the rule travel with the figure. An index that does not say
     what it measured is not citable, which is the reason to publish it. */
  it("publishes the sample size and the minimum sample alongside the figure", () => {
    for (const report of reports) {
      const properties = (priceIndexJsonLd(report) as { "@graph": Record<string, unknown>[] })["@graph"][0]!["additionalProperty"] as {
        name: string;
        value: number;
      }[];
      const byName = Object.fromEntries(properties.map((entry) => [entry.name, entry.value]));
      expect(byName["saleListingSample"], report.citySlug).toBe(report.citySampleSize);
      expect(byName["minimumSampleToPublish"], report.citySlug).toBe(report.minSample);
      expect(byName["localitiesPublished"], report.citySlug).toBe(report.coverage.published);
    }
  });

  /* E §6 hub-and-spoke: parent first, then everything the page covers. */
  it("links up to its city hub and across to every locality it covers", () => {
    for (const report of reports) {
      const links = priceIndexOutboundLinks(report);
      expect(links.parent, report.citySlug).toContain(`/buy/${report.citySlug}/`);
      expect(links.localities.length, report.citySlug).toBe(report.localities.length);
      for (const locality of links.localities) {
        expect(locality.url, locality.name).toMatch(/^https?:\/\/.+\/buy\/.+\/.+\/$/);
      }
    }
  });
});

describe("price index hub", () => {
  it("lists every city, including the ones it cannot publish", () => {
    const graph = (priceIndexHubJsonLd(reports) as { "@graph": Record<string, unknown>[] })["@graph"];
    const items = (graph[0]!["mainEntity"] as { itemListElement: unknown[] })["itemListElement"];
    expect(items.length).toBe(reports.length);
    expect(graph.map((node) => node["@type"])).toEqual(["CollectionPage", "BreadcrumbList"]);
  });

  /* Omitting the gated cities would make the coverage look better than it is,
     which is the one thing that would make the published ones less credible. */
  it("does not hide the gated cities", () => {
    expect(gated.length).toBeGreaterThan(0);
    for (const report of gated) {
      expect(report.blockers.length).toBeGreaterThan(0);
      expect(report.coverage.published).toBe(0);
    }
  });

  it("canonises to the hub", () => {
    expect(priceIndexUrl()).toMatch(/\/price-index\/$/);
  });
});

describe("gating is the report's own rule, not a second opinion", () => {
  /* `publishable` is stricter than `cityPublished`, and the difference is the
     interesting half: a city can clear the bar itself and still be unfit to
     publish because no locality inside it does. Ahmedabad is exactly that —
     4 sale listings against a minimum of 3, but 0 of 6 localities. */
  it("publishes only where the city sample clears the minimum", () => {
    for (const report of reports) {
      expect(report.cityPublished, report.citySlug).toBe(report.citySampleSize >= report.minSample);
      for (const row of report.localities) {
        expect(row.published, `${report.citySlug}/${row.slug}`).toBe(row.saleSampleSize >= report.minSample);
      }
      expect(report.publishable, report.citySlug).toBe(report.cityPublished && report.coverage.published > 0);
    }
  });

  it("is consistent however the report is reached", () => {
    for (const city of getCities()) {
      expect(cityMarketTrends(city.slug).publishable).toBe(reports.find((report) => report.citySlug === city.slug)!.publishable);
    }
  });
});
