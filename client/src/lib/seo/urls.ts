const DEFAULT_SITE_URL = "https://architech-demo.example.com";

function configuredSiteUrl() {
  return typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SITE_URL : undefined;
}

export function normalizeSiteUrl(value = configuredSiteUrl()): string {
  const raw = value?.trim() || DEFAULT_SITE_URL;
  try {
    const url = new URL(raw);
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl();

export function withTrailingSlash(path: string): string {
  const [pathnameWithMaybeQuery = "", queryOrHash = ""] = path.split(/(?=[?#])/, 2);
  const pathname = pathnameWithMaybeQuery.startsWith("/") ? pathnameWithMaybeQuery : `/${pathnameWithMaybeQuery}`;
  if (pathname === "/") return `/${queryOrHash}`;
  return `${pathname.replace(/\/+$/, "")}/${queryOrHash}`;
}

export function canonicalUrl(path = "/", base = SITE_URL): string {
  return `${normalizeSiteUrl(base)}${withTrailingSlash(path)}`;
}

export function assetUrl(path: string, base = SITE_URL): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeSiteUrl(base)}${normalized}`;
}

export function homePath() {
  return "/";
}

export function homeUrl(base?: string) {
  return canonicalUrl(homePath(), base);
}

export function cityPath(citySlug = "ahmedabad", intent: "buy" | "rent" = "buy") {
  return withTrailingSlash(`/${intent}/${citySlug}/`);
}

export function cityUrl(citySlug = "ahmedabad", intent: "buy" | "rent" = "buy", base?: string) {
  return canonicalUrl(cityPath(citySlug, intent), base);
}

export function localityPath(citySlug: string, localitySlug: string, intent: "buy" | "rent" = "buy") {
  return withTrailingSlash(`/${intent}/${citySlug}/${localitySlug}/`);
}

export function localityUrl(citySlug: string, localitySlug: string, intent: "buy" | "rent" = "buy", base?: string) {
  return canonicalUrl(localityPath(citySlug, localitySlug, intent), base);
}

export function listingPath(listingId: string) {
  return withTrailingSlash(`/listing/${listingId}/`);
}

export function listingUrl(listingId: string, base?: string) {
  return canonicalUrl(listingPath(listingId), base);
}

export function guidePath(slug?: string) {
  return withTrailingSlash(slug ? `/guide/${slug}/` : "/guide/");
}

export function guideUrl(slug?: string, base?: string) {
  return canonicalUrl(guidePath(slug), base);
}

export function listPropertyPath() {
  return "/list-property/";
}

export function listPropertyUrl(base?: string) {
  return canonicalUrl(listPropertyPath(), base);
}

export function searchPath() {
  return "/search/";
}

export function searchUrl(base?: string) {
  return canonicalUrl(searchPath(), base);
}

export function requirementsPath() {
  return "/requirements/";
}

export function requirementsUrl(base?: string) {
  return canonicalUrl(requirementsPath(), base);
}

export function developersPath() {
  return "/developers/";
}

export function developersUrl(base?: string) {
  return canonicalUrl(developersPath(), base);
}

export function investmentPath() {
  return "/investment/";
}

export function investmentUrl(base?: string) {
  return canonicalUrl(investmentPath(), base);
}

/* The city property price index.

   Contestant E §5 calls a published price index the one authority lever that
   cannot be faked, and the report behind it already existed — but only behind
   an API route, which no journalist can cite and no searcher can find. This
   is its public surface. Per-city rather than per-locality because the report
   is city-scoped: the locality rows are the table inside it, not pages of
   their own. */
export function priceIndexPath() {
  return "/price-index/";
}

export function priceIndexUrl(base?: string) {
  return canonicalUrl(priceIndexPath(), base);
}

export function cityPriceIndexPath(citySlug: string) {
  return withTrailingSlash(`/price-index/${citySlug}/`);
}

export function cityPriceIndexUrl(citySlug: string, base?: string) {
  return canonicalUrl(cityPriceIndexPath(citySlug), base);
}

export function savedPath() {
  return "/saved/";
}

export function savedUrl(base?: string) {
  return canonicalUrl(savedPath(), base);
}

/** The sitemap *index*. `/sitemap.xml` is kept as the single URL advertised in
    `robots.txt` so existing Search Console history stays valid; it points at one
    child sitemap per content type. */
export function sitemapIndexPath() {
  return "/sitemap.xml";
}

export function sitemapIndexUrl(base?: string) {
  return assetUrl(sitemapIndexPath(), base);
}

/** Self-canonical URL for a paginated page.

    Page 2 must canonicalise to **page 2**, never to page 1. Canonicalising a
    deeper page to page 1 tells Google that pages 2..N are duplicates of page 1
    and can be dropped — which is how listings discovered only on a deeper page
    end up never getting indexed at all.

    Page 1 returns the bare canonical so the clean URL stays the canonical one. */
export function paginatedCanonicalUrl(path: string, page?: number, base?: string): string {
  const url = new URL(canonicalUrl(path, base));
  const safePage = Number.isFinite(page) && (page as number) > 1 ? Math.floor(page as number) : 1;
  if (safePage > 1) url.searchParams.set("page", String(safePage));
  return url.toString();
}

/** Child sitemap for one content type, e.g. `/sitemap/localities.xml`.

    The segment sits in a directory rather than a dotted filename
    (`/sitemap-localities.xml`) because Next.js will not route a path whose last
    segment contains a dot to a dynamic route, and because `trailingSlash: true`
    would otherwise redirect a file-looking URL. */
export function sitemapSegmentPath(segment: string) {
  return `/sitemap/${segment}.xml`;
}

export function sitemapSegmentUrl(segment: string, base?: string) {
  return assetUrl(sitemapSegmentPath(segment), base);
}
