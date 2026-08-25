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

export function savedPath() {
  return "/saved/";
}

export function savedUrl(base?: string) {
  return canonicalUrl(savedPath(), base);
}

export function sitemapPath() {
  return "/sitemap.xml";
}

export function sitemapUrl(base?: string) {
  return assetUrl(sitemapPath(), base);
}
