/* Head for the city property price index (StudyArena round-12, contestant E §5).

   E calls a published price index the one authority lever that cannot be
   faked — "journalists cite these → free news links". The report behind it
   already existed, already gated behind a minimum sample, and was already
   honest about its own coverage gaps. What did not exist was any way to
   reach it: it was served only as JSON from an API route, and nobody cites a
   JSON endpoint.

   This module is the head — metadata and JSON-LD — so the gate that decides
   what the report may print also decides whether the page may be indexed.
   Withholding the number and withholding the page are one decision, made in
   one place.

   `Dataset` markup was considered and not used. Google's Dataset rich results
   target Dataset Search, a separate vertical for research and government
   data; marking a marketing-adjacent price table as a `Dataset` overstates
   it. `Article` with `about` the city is accurate for what this page is: a
   dated report. */
import type { Metadata } from "next";
import { getCities } from "@/lib/repositories";
import { cityMarketTrends, type CityMarketTrends } from "@/lib/realestate/market-trends";
import { priceIndexSerpDescription, priceIndexSerpTitle, priceIndexHubSerpDescription, priceIndexHubSerpTitle } from "./serp";
import { defaultSocialImage } from "./social";
import { cityPriceIndexUrl, cityUrl, homeUrl, localityUrl, priceIndexUrl } from "./urls";

/** SERP input read straight off the report, so the gate that withholds a
    figure from the page also withholds it from the snippet. */
function serpInput(report: CityMarketTrends) {
  return {
    cityName: report.cityName,
    medianPriceInr: report.cityMedianPriceInr,
    avgPricePerSqftInr: report.cityAvgPricePerSqftInr,
    sampleSize: report.citySampleSize,
    localityCount: report.localities.length,
    asOfLabel: report.asOfLabel,
    publishable: report.publishable,
    blockers: report.blockers,
  };
}

export function priceIndexMetadata(report: CityMarketTrends): Metadata {
  const canonical = cityPriceIndexUrl(report.citySlug);
  return {
    title: priceIndexSerpTitle(serpInput(report)),
    description: priceIndexSerpDescription(serpInput(report)),
    alternates: { canonical },
    /* The report's own bar decides. A city whose sample is too small prints
       no figures, and a page with no figures is exactly the thin page E §6
       says to noindex rather than publish and hope. */
    robots: report.publishable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: priceIndexSerpTitle(serpInput(report)),
      description: priceIndexSerpDescription(serpInput(report)),
      url: canonical,
      type: "article",
      images: [defaultSocialImage()],
    },
  };
}

export function priceIndexJsonLd(report: CityMarketTrends) {
  const canonical = cityPriceIndexUrl(report.citySlug);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${canonical}#report`,
        headline: `${report.cityName} property price index — ${report.asOfLabel}`,
        description: priceIndexSerpDescription(serpInput(report)),
        author: { "@type": "Organization", name: "Architech" },
        dateModified: report.asOfDate,
        datePublished: report.asOfDate,
        mainEntityOfPage: canonical,
        about: { "@type": "Place", name: report.cityName },
        isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() },
        /* The sample and the rule travel with the figure. A price index that
           does not say what it measured is not citable, which is the whole
           point of publishing it. */
        additionalProperty: [
          { "@type": "PropertyValue", name: "saleListingSample", value: report.citySampleSize },
          { "@type": "PropertyValue", name: "minimumSampleToPublish", value: report.minSample },
          { "@type": "PropertyValue", name: "localitiesPublished", value: report.coverage.published },
          { "@type": "PropertyValue", name: "localitiesTotal", value: report.coverage.total },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl() },
          { "@type": "ListItem", position: 2, name: "Property price index", item: priceIndexUrl() },
          { "@type": "ListItem", position: 3, name: report.cityName, item: canonical },
        ],
      },
    ],
  };
}

/** Every city report, publishable or not, in registry order. Used by the hub
    so the coverage gaps are visible rather than silently omitted. */
export function allCityMarketTrends(): CityMarketTrends[] {
  return getCities().map((city) => cityMarketTrends(city.slug));
}

export function priceIndexHubMetadata(): Metadata {
  const canonical = priceIndexUrl();
  return {
    title: priceIndexHubSerpTitle(),
    description: priceIndexHubSerpDescription(),
    alternates: { canonical },
  };
}

export function priceIndexHubJsonLd(reports: CityMarketTrends[]) {
  const hub = priceIndexUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${hub}#collection`,
        name: "Property price index",
        description: priceIndexHubSerpDescription(),
        url: hub,
        isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: reports.map((report, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: `${report.cityName} property price index`,
            url: cityPriceIndexUrl(report.citySlug),
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl() },
          { "@type": "ListItem", position: 2, name: "Property price index", item: hub },
        ],
      },
    ],
  };
}

/** Where a city report links out: its city hub, then every locality it
    covers — E §6's hub-and-spoke, parent first. */
export function priceIndexOutboundLinks(report: CityMarketTrends) {
  return {
    parent: cityUrl(report.citySlug),
    localities: report.localities.map((row) => ({
      name: row.name,
      url: localityUrl(report.citySlug, row.slug),
      published: row.published,
    })),
  };
}
