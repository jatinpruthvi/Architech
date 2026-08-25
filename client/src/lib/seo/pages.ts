import { getGuides, getListings, getLocalities } from "@/lib/repositories";
import { isIndexable } from "./lifecycle";
import { cityPath, cityUrl, developersPath, developersUrl, guidePath, guideUrl, homePath, homeUrl, investmentPath, investmentUrl, listPropertyPath, listPropertyUrl, listingPath, listingUrl, localityPath, localityUrl, requirementsPath, requirementsUrl } from "./urls";

export type SeoRouteType = "home" | "city" | "locality" | "listing" | "guide";
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
  sitemap: {
    changeFrequency: SeoChangeFrequency;
    priority: number;
  };
};

const CITY_SLUG = "ahmedabad";

const homePage: SeoPage = {
  id: "home",
  routeType: "home",
  path: homePath(),
  canonicalUrl: homeUrl(),
  primaryIntent: "Introduce Architech and route users to Ahmedabad home discovery.",
  indexability: "indexable",
  owner: "Product",
  qualityState: "prototype-validated",
  freshnessPolicy: "Refresh when inventory, city coverage, or methodology claims materially change.",
  entityIds: ["brand:architech", "city:ahmedabad"],
  sitemap: { changeFrequency: "daily", priority: 1 },
};

const cityPage: SeoPage = {
  id: `city:${CITY_SLUG}:buy`,
  routeType: "city",
  path: cityPath(CITY_SLUG),
  canonicalUrl: cityUrl(CITY_SLUG),
  primaryIntent: "Help buyers compare Ahmedabad localities before selecting a property.",
  indexability: "indexable",
  owner: "SEO",
  qualityState: "prototype-validated",
  freshnessPolicy: "Refresh when locality coverage, counts, or city-level internal links change.",
  entityIds: [`city:${CITY_SLUG}`],
  sitemap: { changeFrequency: "daily", priority: 0.9 },
};

const localityPages: SeoPage[] = getLocalities().map((locality) => ({
  id: `locality:${CITY_SLUG}:${locality.slug}:buy`,
  routeType: "locality",
  path: localityPath(CITY_SLUG, locality.slug),
  canonicalUrl: localityUrl(CITY_SLUG, locality.slug),
  primaryIntent: `Show homes and locality context for ${locality.name}, Ahmedabad.`,
  indexability: "indexable",
  owner: "SEO",
  qualityState: "prototype-validated",
  freshnessPolicy: "Refresh when listings, coordinates, landmarks, or locality editorial context materially change.",
  entityIds: [`city:${CITY_SLUG}`, `locality:${locality.slug}`],
  sitemap: { changeFrequency: "daily", priority: 0.8 },
}));

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
  entityIds: [`city:${CITY_SLUG}`, `locality:${property.localitySlug}`, `listing:${property.id}`],
  sitemap: { changeFrequency: "daily", priority: 0.7 },
}));

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
  entityIds: ["brand:architech", "city:ahmedabad", "topic:property-requirements"],
  sitemap: { changeFrequency: "monthly", priority: 0.6 },
};

const developersPage: SeoPage = {
  id: "page:developers",
  routeType: "guide",
  path: developersPath(),
  canonicalUrl: developersUrl(),
  primaryIntent: "Help users discover Ahmedabad builders and projects with context and evidence policy.",
  indexability: "indexable",
  owner: "SEO",
  qualityState: "needs-production-data",
  freshnessPolicy: "Refresh when developer evidence, project links, or partner status changes.",
  entityIds: ["brand:architech", "city:ahmedabad", "topic:developers"],
  sitemap: { changeFrequency: "weekly", priority: 0.6 },
};

const investmentPage: SeoPage = {
  id: "page:investment",
  routeType: "guide",
  path: investmentPath(),
  canonicalUrl: investmentUrl(),
  primaryIntent: "Provide general Ahmedabad property context without personalized financial recommendations.",
  indexability: "indexable",
  owner: "Content",
  qualityState: "editorial-review-required",
  freshnessPolicy: "Refresh when sources, legal disclaimers, or locality context changes.",
  entityIds: ["brand:architech", "city:ahmedabad", "topic:investment-context"],
  sitemap: { changeFrequency: "monthly", priority: 0.5 },
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

export const seoPages: SeoPage[] = [homePage, cityPage, ...localityPages, ...listingPages, guidePage, ...guideDetailPages, requirementsPage, developersPage, investmentPage, listPropertyPage];

export function getIndexableSeoPages() {
  return seoPages.filter((page) => page.indexability === "indexable");
}

export function findSeoPageByPath(path: string) {
  return seoPages.find((page) => page.path === path);
}
