import { getCities, getGuides, getListings, getLocalities } from "@/lib/repositories";
import { localityIntel } from "@/lib/realestate/locality-intel";
import { cityMarketTrends } from "@/lib/realestate/market-trends";
import { evaluateSeoPageQuality } from "./page-gate";
import type { PageQualityDecision } from "./page-quality";
import { isIndexable } from "./lifecycle";
import { listingTargetQuery } from "./query-targeting";
import { canonicalUrl, cityPath, cityUrl, developersPath, developersUrl, guidePath, guideUrl, homePath, homeUrl, investmentPath, investmentUrl, listPropertyPath, listPropertyUrl, listingPath, listingUrl, localityPath, localityUrl, priceIndexPath, priceIndexUrl, cityPriceIndexPath, cityPriceIndexUrl, requirementsPath, requirementsUrl } from "./urls";

export type SeoRouteType = "home" | "hub" | "city" | "locality" | "listing" | "guide" | "report";

/** Child sitemap a page is published in. Segmentation lets Search Console
    report coverage per content type, so a locality-fact problem never hides
    inside one flat 400-URL sitemap (StudyArena round-11, contestant A §5). */
export type SeoSitemapSegment = "pages" | "cities" | "localities" | "listings" | "guides" | "reports";
export type SeoIndexability = "indexable" | "noindex";
export type SeoQualityState = "prototype-validated" | "needs-production-data" | "editorial-review-required";
export type SeoOwner = "Product" | "SEO" | "Content";
export type SeoChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export type SeoPage = {
  id: string;
  routeType: SeoRouteType;
  path: string;
  canonicalUrl: string;
  primaryIntent: string;
  indexability: SeoIndexability;
  owner: SeoOwner;
  qualityState: SeoQualityState;
  freshnessPolicy: string;
  entityIds: string[];
  /** Child sitemap this page belongs to. Omit to use the route-type default. */
  sitemapSegment?: SeoSitemapSegment;
  /** The query this page is the answer to.

      Declared as data rather than left implicit in the title, because
      measurement needs something to measure against: without a declared
      target you can only look at impressions and guess what the page was
      aiming at, which makes a miss indistinguishable from a bad month.
      Optional because only pages answering a specific query have one — a
      standing page does not. */
  targetQuery?: string;
  /** ISO `YYYY-MM-DD` date the page's *content* last changed, from the
      underlying entity — never the request/build clock.

      `lastmod` is a promise to Google about when the page changed. Stamping
      `new Date()` makes every sitemap entry claim "changed just now" on every
      build, which is exactly the signal Google discounts. A page whose entity
      carries no date (a standing page with no dated source) omits `lastmod`
      entirely rather than inventing one. */
  lastModified?: string;
  sitemap: {
    changeFrequency: SeoChangeFrequency;
    priority: number;
  };
};

const SEGMENT_BY_ROUTE_TYPE: Record<SeoRouteType, SeoSitemapSegment> = {
  home: "pages",
  hub: "pages",
  city: "cities",
  locality: "localities",
  listing: "listings",
  guide: "guides",
  report: "reports",
};

/** Resolve a page's child sitemap: the explicit override wins, otherwise the
    route type decides. */
export function sitemapSegmentForPage(page: Pick<SeoPage, "routeType" | "sitemapSegment">): SeoSitemapSegment {
  return page.sitemapSegment ?? SEGMENT_BY_ROUTE_TYPE[page.routeType];
}

const homePage: SeoPage = {
  id: "home",
  routeType: "home",
  path: homePath(),
  canonicalUrl: homeUrl(),
  primaryIntent: "Introduce Architech and route users to home discovery across Indian cities.",
  indexability: "indexable",
  owner: "Product",
  qualityState: "prototype-validated",
  freshnessPolicy: "Refresh when inventory, city coverage, or methodology claims materially change.",
  entityIds: ["brand:architech", "country:india"],
  sitemap: { changeFrequency: "daily", priority: 1 },
};

/** National hub above the city hubs — the crawl entry point for every market. */
const locationsIndiaPage: SeoPage = {
  id: "hub:locations:india",
  routeType: "hub",
  path: "/locations/",
  canonicalUrl: canonicalUrl("/locations/"),
  primaryIntent: "Expose sourced India-wide State, Union Territory, exact PIN, post-office, and LGD local-body reference coverage without conflating property inventory.",
  indexability: "indexable",
  owner: "Product",
  qualityState: "prototype-validated",
  freshnessPolicy: "Refresh when an official location snapshot is applied, retired, or fails freshness gates.",
  entityIds: ["brand:architech", "country:india", "dataset:official-location-reference"],
  lastModified: "2026-08-30",
  sitemap: { changeFrequency: "monthly", priority: 0.75 },
};

const buyIndiaPage: SeoPage = {
  id: "hub:buy:india",
  routeType: "hub",
  path: "/buy/",
  canonicalUrl: canonicalUrl("/buy/"),
  primaryIntent: "Route buyers to the right Indian city hub and expose national coverage.",
  indexability: "indexable",
  owner: "SEO",
  qualityState: "prototype-validated",
  freshnessPolicy: "Refresh whenever a city is launched, paused, or retired.",
  entityIds: ["brand:architech", "country:india"],
  sitemap: { changeFrequency: "daily", priority: 0.95 },
};

/* Locality fact dates are computed once and shared: a city hub is as fresh as
   the newest locality it aggregates, and recomputing per call would make
   registry construction O(cities × localities × listings). */
const localityFactDates = new Map<string, string>(
  getLocalities().map((locality) => [locality.slug, localityIntel(locality.slug, locality.citySlug).asOfDate] as const),
);

/** Newest locality fact date inside a city — the honest `lastmod` for its hub. */
function cityFactDate(citySlug: string): string | undefined {
  const dates = getLocalities(citySlug)
    .map((locality) => localityFactDates.get(locality.slug))
    .filter((date): date is string => Boolean(date))
    .sort();
  return dates.length ? dates[dates.length - 1] : undefined;
}

/* One hub per live city, generated from the city registry so launching a city
   is a single registry edit (SEO-002). */
const cityPages: SeoPage[] = getCities().map((city) => ({
  id: `city:${city.slug}:buy`,
  routeType: "city",
  path: cityPath(city.slug),
  canonicalUrl: cityUrl(city.slug),
  primaryIntent: `Help buyers compare ${city.name} localities before selecting a property.`,
  indexability: "indexable",
  owner: "SEO",
  qualityState: "prototype-validated",
  freshnessPolicy: "Refresh when locality coverage, counts, or city-level internal links change.",
  entityIds: [`city:${city.slug}`, `state:${city.stateSlug}`],
  lastModified: cityFactDate(city.slug),
  sitemap: { changeFrequency: "daily", priority: 0.9 },
}));

const localityPages: SeoPage[] = getCities().flatMap((city) =>
  getLocalities(city.slug).map((locality) => ({
    id: `locality:${city.slug}:${locality.slug}:buy`,
    routeType: "locality" as const,
    path: localityPath(city.slug, locality.slug),
    canonicalUrl: localityUrl(city.slug, locality.slug),
    primaryIntent: `Show homes and locality context for ${locality.name}, ${city.name}.`,
    indexability: "indexable" as const,
    owner: "SEO" as const,
    qualityState: "prototype-validated" as const,
    freshnessPolicy: "Refresh when listings, coordinates, landmarks, or locality editorial context materially change.",
    entityIds: [`city:${city.slug}`, `locality:${locality.slug}`],
    // The date the locality's own aggregated facts were last refreshed.
    lastModified: localityFactDates.get(locality.slug),
    sitemap: { changeFrequency: "daily" as const, priority: 0.8 },
  })),
);

const listingPages: SeoPage[] = getListings().map((property) => ({
  id: `listing:${property.id}`,
  routeType: "listing",
  path: listingPath(property.id),
  canonicalUrl: listingUrl(property.id),
  primaryIntent: `Present property facts, trust context, and next action for ${property.title}.`,
  // Only ACTIVE listings are indexable; SOLD context stays viewable but noindexed,
  // and non-public states are excluded entirely (SEO-003/SEO-004).
  indexability: isIndexable(property.lifecycle ?? "ACTIVE") ? "indexable" : "noindex",
  owner: "SEO",
  qualityState: "needs-production-data",
  freshnessPolicy: "Refresh on every meaningful listing edit, price/status change, verification update, or lifecycle transition.",
  entityIds: [`city:${property.citySlug}`, `locality:${property.localitySlug}`, `listing:${property.id}`],
  // The query this page is the answer to, declared as data so measurement has
  // something to measure against. See client/src/lib/seo/query-targeting.ts.
  targetQuery: listingTargetQuery(property).text,
  // Mirrors `Listing.meaningfulUpdatedAt`, not `updatedAt`: a moderation touch
  // is not a content change and must not bump `lastmod`.
  lastModified: property.meaningfulUpdatedAt,
  sitemap: { changeFrequency: "daily", priority: 0.7 },
}));

/* The guide index renders the guide list, so its honest `lastmod` is the
   newest guide revision it displays — not the build clock. */
const newestGuideUpdate = getGuides()
  .map((guide) => guide.updatedAt)
  .sort()
  .pop();

const guidePage: SeoPage = {
  id: "guide:index",
  routeType: "guide",
  path: guidePath(),
  canonicalUrl: guideUrl(),
  primaryIntent: "Explain Architech verification methodology and trust principles.",
  indexability: "indexable",
  owner: "Content",
  qualityState: "editorial-review-required",
  freshnessPolicy: "Refresh when verification methodology, source policy, or editorial guidance changes.",
  entityIds: ["brand:architech", "topic:verification-methodology"],
  lastModified: newestGuideUpdate,
  sitemap: { changeFrequency: "weekly", priority: 0.6 },
};


const guideDetailPages: SeoPage[] = getGuides().map((guide) => ({
  id: `guide:${guide.id}`,
  routeType: "guide",
  path: guide.path,
  canonicalUrl: guideUrl(guide.path.replace(/^\/guide\//, "").replace(/\/$/, "")),
  primaryIntent: `Provide a sourced guide: ${guide.title}.`,
  indexability: guide.status === "published" ? "indexable" : "noindex",
  owner: "Content",
  qualityState: guide.status === "published" ? "prototype-validated" : "editorial-review-required",
  freshnessPolicy: "Refresh when source evidence, reviewer status, or market guidance changes.",
  entityIds: ["brand:architech", `guide:${guide.id}`],
  // Guides are the one surface with a real editorial date attached.
  lastModified: guide.updatedAt,
  sitemap: { changeFrequency: "monthly", priority: 0.5 },
}));

const requirementsPage: SeoPage = {
  id: "page:requirements",
  routeType: "home",
  path: requirementsPath(),
  canonicalUrl: requirementsUrl(),
  primaryIntent: "Capture a privacy-aware buyer, renter, owner, agent, or builder requirement brief.",
  indexability: "indexable",
  owner: "Product",
  qualityState: "prototype-validated",
  freshnessPolicy: "Refresh when the requirement fields, consent language, or routing policy changes.",
  entityIds: ["brand:architech", "country:india", "topic:property-requirements"],
  sitemap: { changeFrequency: "monthly", priority: 0.6 },
};

const developersPage: SeoPage = {
  id: "page:developers",
  routeType: "guide",
  path: developersPath(),
  canonicalUrl: developersUrl(),
  primaryIntent: "Help users discover Indian builders and projects with context and evidence policy.",
  indexability: "indexable",
  owner: "SEO",
  qualityState: "needs-production-data",
  freshnessPolicy: "Refresh when developer evidence, project links, or partner status changes.",
  entityIds: ["brand:architech", "country:india", "topic:developers"],
  // A standing product/tool page, not an editorial guide: keep it out of the guides sitemap.
  sitemapSegment: "pages",
  sitemap: { changeFrequency: "weekly", priority: 0.6 },
};

const investmentPage: SeoPage = {
  id: "page:investment",
  routeType: "guide",
  path: investmentPath(),
  canonicalUrl: investmentUrl(),
  primaryIntent: "Provide general Indian property-market context without personalized financial recommendations.",
  indexability: "indexable",
  owner: "Content",
  qualityState: "editorial-review-required",
  freshnessPolicy: "Refresh when sources, legal disclaimers, or locality context changes.",
  entityIds: ["brand:architech", "country:india", "topic:investment-context"],
  // A standing product/tool page, not an editorial guide: keep it out of the guides sitemap.
  sitemapSegment: "pages",
  sitemap: { changeFrequency: "monthly", priority: 0.5 },
};

const aboutPage: SeoPage = {
  id: "page:about",
  routeType: "home",
  path: "/about-us/",
  canonicalUrl: canonicalUrl("/about-us/"),
  primaryIntent: "Explain Architech’s India-wide product, evidence policy, and place-first approach.",
  indexability: "indexable",
  owner: "Product",
  qualityState: "prototype-validated",
  freshnessPolicy: "Refresh when company positioning, methodology, or coverage changes.",
  entityIds: ["brand:architech", "country:india"],
  sitemap: { changeFrequency: "monthly", priority: 0.4 },
};

const contactPage: SeoPage = {
  id: "page:contact",
  routeType: "home",
  path: "/contact-us/",
  canonicalUrl: canonicalUrl("/contact-us/"),
  primaryIntent: "Provide a clear, privacy-aware contact path for product, property, and editorial enquiries.",
  indexability: "indexable",
  owner: "Product",
  qualityState: "needs-production-data",
  freshnessPolicy: "Refresh when approved contact channels and response policy change.",
  entityIds: ["brand:architech", "country:india"],
  sitemap: { changeFrequency: "monthly", priority: 0.4 },
};

const homeLoanPage: SeoPage = {
  id: "page:home-loan",
  routeType: "guide",
  path: "/home-loan/",
  canonicalUrl: canonicalUrl("/home-loan/"),
  primaryIntent: "Explain indicative home-loan calculations without personalized financial advice.",
  indexability: "indexable",
  owner: "Content",
  qualityState: "editorial-review-required",
  freshnessPolicy: "Refresh when calculator assumptions, disclosures, or approved providers change.",
  entityIds: ["brand:architech", "country:india", "topic:home-loan-context"],
  // A standing product/tool page, not an editorial guide: keep it out of the guides sitemap.
  sitemapSegment: "pages",
  sitemap: { changeFrequency: "monthly", priority: 0.4 },
};

const reviewPage: SeoPage = {
  id: "page:review",
  routeType: "home",
  path: "/review/",
  canonicalUrl: canonicalUrl("/review/"),
  primaryIntent: "Collect honest user feedback only after consent and moderation are activated.",
  indexability: "noindex",
  owner: "Product",
  qualityState: "needs-production-data",
  freshnessPolicy: "Refresh when moderation, consent, or retention policy changes.",
  entityIds: ["brand:architech"],
  sitemap: { changeFrequency: "yearly", priority: 0.1 },
};

const htmlSitemapPage: SeoPage = {
  id: "page:sitemap-html",
  routeType: "home",
  path: "/sitemap.html/",
  canonicalUrl: canonicalUrl("/sitemap.html/"),
  primaryIntent: "Expose Architech’s reviewed public route hierarchy to users and crawlers.",
  indexability: "indexable",
  owner: "SEO",
  qualityState: "prototype-validated",
  freshnessPolicy: "Refresh whenever a crawlable public route is added, removed, or materially changed.",
  entityIds: ["brand:architech", "country:india"],
  sitemap: { changeFrequency: "weekly", priority: 0.5 },
};

const listPropertyPage: SeoPage = {
  id: "page:list-property",
  routeType: "home",
  path: listPropertyPath(),
  canonicalUrl: listPropertyUrl(),
  primaryIntent: "Help owners/sellers submit a listing for moderation so it can be published with a source trail.",
  indexability: "indexable",
  owner: "Product",
  qualityState: "prototype-validated",
  freshnessPolicy: "Refresh when the listing submission flow or source-trail language changes.",
  entityIds: ["brand:architech"],
  sitemap: { changeFrequency: "monthly", priority: 0.6 },
};

/* City property price indexes (StudyArena round-12, contestant E §5).

   The report itself already existed and is already gated — see
   `market-trends.ts`. What did not exist was any way to reach it: it was only
   served as JSON from an API route, and a journalist cannot cite a JSON
   endpoint or a searcher find one. E calls a published price index the one
   authority lever that cannot be faked, which is only true once it is a page.

   Indexability follows the report's own gate rather than a second opinion: a
   city whose sample is below the minimum publishes no figures, so its page is
   held back from Google while still showing the coverage gap and the blocker.
   Withholding the number and withholding the page are the same decision. */

const priceIndexHubPage: SeoPage = {
  id: "page:price-index",
  routeType: "report",
  path: priceIndexPath(),
  canonicalUrl: priceIndexUrl(),
  primaryIntent: "Publish one citable property price index per Indian city, with the sample and methodology behind every figure.",
  indexability: "indexable",
  owner: "Content",
  qualityState: "needs-production-data",
  freshnessPolicy: "Refresh when any city's median, rate per square foot, or coverage changes.",
  entityIds: ["brand:architech", "country:india", "topic:price-index"],
  sitemap: { changeFrequency: "weekly", priority: 0.7 },
};

const cityPriceIndexPages: SeoPage[] = getCities().map((city) => {
  const report = cityMarketTrends(city.slug);
  return {
    id: `report:price-index:${city.slug}`,
    routeType: "report" as const,
    path: cityPriceIndexPath(city.slug),
    canonicalUrl: cityPriceIndexUrl(city.slug),
    primaryIntent: `Publish the ${city.name} property price index: median price and rate per square foot by locality, with coverage stated.`,
    // The report's own publication bar decides, not a separate rule.
    indexability: report.publishable ? ("indexable" as const) : ("noindex" as const),
    owner: "Content" as const,
    qualityState: report.publishable
      ? ("prototype-validated" as const)
      : ("needs-production-data" as const),
    freshnessPolicy: "Refresh when the city's sale listings, medians, or locality coverage change.",
    entityIds: [`city:${city.slug}`, "topic:price-index"],
    lastModified: report.asOfDate,
    sitemap: { changeFrequency: "weekly" as const, priority: 0.7 },
  };
});

export const seoPages: SeoPage[] = [homePage, priceIndexHubPage, ...cityPriceIndexPages, buyIndiaPage, locationsIndiaPage, ...cityPages, ...localityPages, ...listingPages, guidePage, ...guideDetailPages, requirementsPage, developersPage, investmentPage, aboutPage, contactPage, homeLoanPage, reviewPage, htmlSitemapPage, listPropertyPage];

/* Quality decisions are computed once at module load: evaluating per call would
   re-scan the listing table for every consumer. */
const qualityByPageId: ReadonlyMap<string, PageQualityDecision> = new Map(
  getIndexableSeoPages().map((page) => [page.id, evaluateSeoPageQuality(page)] as const),
);

export function getIndexableSeoPages() {
  return seoPages.filter((page) => page.indexability === "indexable");
}

/** Pages that are both registry-indexable and quality-gate approved.

    This is the set that reaches a sitemap. The registry decides what we *want*
    indexed; `page-gate.ts` decides whether the page has the evidence to earn
    it. Keeping the two separate is what stops a generated page from being
    published just because someone added it to the registry. */
export function getPublishableSeoPages() {
  return getIndexableSeoPages().filter((page) => qualityByPageId.get(page.id)?.indexable ?? false);
}

/** The quality decision for a page, or undefined if it is not registered. */
export function qualityDecisionFor(pageId: string) {
  return qualityByPageId.get(pageId);
}

/** Pages the registry wants indexed but the quality gate holds back, with the
    reasons. This is the report to act on — not an error, a worklist. */
export function getHeldBackPages(): { page: SeoPage; decision: PageQualityDecision }[] {
  const held: { page: SeoPage; decision: PageQualityDecision }[] = [];
  for (const page of getIndexableSeoPages()) {
    const decision = qualityByPageId.get(page.id);
    if (decision && !decision.indexable) held.push({ page, decision });
  }
  return held;
}

export function findSeoPageByPath(path: string) {
  return seoPages.find((page) => page.path === path);
}
