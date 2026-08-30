/* Sitemap segmentation and deterministic `lastmod`.

   Why this module exists (StudyArena round-11, contestant A §5):
   "XML sitemaps split into properties, localities, projects and guides" with
   "accurate `lastmod` values". Both halves matter:

   - Segmentation turns one flat sitemap into per-type child sitemaps, so
     Search Console reports coverage for locality pages separately from listing
     dossiers. A drop in indexed locality pages is visible immediately instead
     of hiding in a single 400-URL average.
   - `lastmod` is a factual claim about when a page changed. Stamping the build
     clock makes every URL claim "changed just now" on every deploy, which is
     the fastest way to get the field ignored. Dates here always come from the
     entity that owns the page, and a page with no datable entity omits the
     field rather than guessing.

   Pure and server-safe: no request, no clock, no I/O. */
import { getPublishableSeoPages, sitemapSegmentForPage, type SeoPage, type SeoSitemapSegment } from "./pages";
import { isPublicIndexingEnabled, type RuntimeEnvironment } from "./runtime";
import { sitemapSegmentUrl } from "./urls";

export type SitemapSegment = {
  id: SeoSitemapSegment;
  label: string;
  description: string;
};

/** Ordered so the index reads the way the site is crawled: standing pages,
    then the place hierarchy, then inventory, then editorial, then reports. */
export const SITEMAP_SEGMENTS: readonly SitemapSegment[] = [
  { id: "pages", label: "Standing pages", description: "Home, national hub, requirements, list-property, about, contact, and tools." },
  { id: "cities", label: "City hubs", description: "/buy/{city}/ — one hub per launched city." },
  { id: "localities", label: "Locality pages", description: "/buy/{city}/{locality}/ — the hyperlocal intent surface." },
  { id: "listings", label: "Property dossiers", description: "/listing/{id}/ — indexable (ACTIVE) listings only." },
  { id: "guides", label: "Field notes", description: "/guide/… — methodology and locality buying guides." },
  { id: "reports", label: "Price indexes", description: "/price-index/{city}/ — the citable per-city property price index." },
];

const SEGMENT_IDS = new Set<string>(SITEMAP_SEGMENTS.map((segment) => segment.id));

export type SitemapUrlEntry = {
  loc: string;
  lastModified?: string;
  changeFrequency?: string;
  priority?: number;
};

/** Parse a `YYYY-MM-DD` entity date into a Date without letting the runtime
    locale turn it into the previous/next day. Returns undefined for anything
    unparseable so a bad fixture degrades to "no lastmod", never to "now". */
export function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function isSitemapSegment(value: string): value is SeoSitemapSegment {
  return SEGMENT_IDS.has(value);
}

/** Published pages in one segment, in registry order.

    "Published" is registry-indexable **and** quality-gate approved. A page the
    gate holds back stays useful to users but is never submitted to Google —
    which is exactly what makes programmatic page generation safe. */
export function getSegmentPages(segment: SeoSitemapSegment): SeoPage[] {
  return getPublishableSeoPages().filter((page) => sitemapSegmentForPage(page) === segment);
}

/** Every page must land in exactly one child sitemap — a page in two is a
    duplicate-submission bug, a page in none is silently uncrawlable. */
export function collectUnsegmentedPages(): SeoPage[] {
  return getPublishableSeoPages().filter((page) => !isSitemapSegment(sitemapSegmentForPage(page)));
}

export function toSitemapEntries(pages: SeoPage[]): SitemapUrlEntry[] {
  return pages.map((page) => ({
    loc: page.canonicalUrl,
    ...(page.lastModified ? { lastModified: page.lastModified } : {}),
    changeFrequency: page.sitemap.changeFrequency,
    priority: page.sitemap.priority,
  }));
}

/** The index advertises each child sitemap at the newest date inside it, so
    Google can skip a child sitemap whose contents have not moved. */
export function toSitemapIndexEntries(): SitemapUrlEntry[] {
  return SITEMAP_SEGMENTS.map((segment) => {
    const dates = getSegmentPages(segment.id)
      .map((page) => page.lastModified)
      .filter((date): date is string => Boolean(date))
      .sort();
    return {
      loc: sitemapSegmentUrl(segment.id),
      ...(dates.length ? { lastModified: dates[dates.length - 1] } : {}),
    };
  });
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => XML_ESCAPES[character]);
}

/** W3C datetime for `lastmod`: a plain date is valid and — unlike a build
    timestamp — it is stable across deploys. */
function lastModForXml(value?: string): string {
  const date = parseIsoDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

export function renderUrlsetXml(entries: SitemapUrlEntry[]): string {
  const urls = entries
    .map((entry) => {
      const lastmod = lastModForXml(entry.lastModified);
      return [
        "  <url>",
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
        ...(entry.changeFrequency ? [`    <changefreq>${escapeXml(entry.changeFrequency)}</changefreq>`] : []),
        ...(typeof entry.priority === "number" ? [`    <priority>${entry.priority.toFixed(1)}</priority>`] : []),
        "  </url>",
      ].join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderSitemapIndexXml(entries: SitemapUrlEntry[]): string {
  const sitemaps = entries
    .map((entry) => {
      const lastmod = lastModForXml(entry.lastModified);
      return [
        "  <sitemap>",
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
        "  </sitemap>",
      ].join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps}\n</sitemapindex>\n`;
}

/** Child-sitemap payload for one segment. Empty while public indexing is
    gated off, so a preview build never advertises URLs that are `noindex`. */
export function buildSegmentSitemap(segment: SeoSitemapSegment, env: RuntimeEnvironment = process.env): string {
  if (!isPublicIndexingEnabled(env)) return renderUrlsetXml([]);
  return renderUrlsetXml(toSitemapEntries(getSegmentPages(segment)));
}

export function buildSitemapIndex(env: RuntimeEnvironment = process.env): string {
  if (!isPublicIndexingEnabled(env)) return renderSitemapIndexXml([]);
  return renderSitemapIndexXml(toSitemapIndexEntries());
}
