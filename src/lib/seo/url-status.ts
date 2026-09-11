/* Per-URL status: what each page is, and what is known about it.

   This is the measurement surface, and it is built around a constraint that
   has to be stated before anything else: **the Search Console data here is not
   per-URL yet, and the demo provider's numbers are fabricated.**

   Both facts are represented in the data rather than left to a comment.
   `PageMeasurement` carries the source, and a demo snapshot is reported as
   unavailable rather than as measurement. A dashboard that renders 3,200
   impressions from a fixture is worse than one that says "not connected",
   because the first gets believed. Every SEO tool's most dangerous state is
   showing confident numbers that came from nowhere.

   What *is* available without any credential is most of the board: whether a
   page is indexable, whether the gate approved it and why not, whether it is
   in a sitemap, what query it declared, and when its content last changed.
   That is enough to answer the question that matters most at this stage —
   "is this page ready, and is anything blocking it?" — without pretending to
   know how it is performing.

   Per-URL ingestion is the large piece in §3.7 and needs domain verification
   plus the Search Console API. The `perUrl` flag exists so the UI can say so
   instead of implying the gaps are zero. */
import { getPublishableSeoPages, type SeoPage } from "./pages";
import { evaluateSeoPageQuality } from "./page-gate";
import { getGscHealth } from "./gsc";
import { SITEMAP_SEGMENTS, getSegmentPages } from "./sitemap";

export type PageMeasurement =
  | { available: false; source: string; reason: string }
  | {
      available: true;
      source: string;
      /** Aggregate only. The Search Console API's per-URL inspection is not
          wired, so nothing here can be attributed to a single page. */
      perUrl: false;
      impressions: number;
      clicks: number;
      submittedUrls: number;
      indexedUrls: number;
    };

export type PageStatusRow = {
  path: string;
  canonicalUrl: string;
  indexable: boolean;
  /** Whether the page is in a child sitemap. A page outside every sitemap
      depends on a crawl finding it by accident. */
  inSitemap: boolean;
  sitemapSegmentCount: number;
  gate: "approved" | "held";
  gateReasons: string[];
  declaredQuery?: string;
  lastModified?: string;
};

export type SeoStatusBoard = {
  rows: PageStatusRow[];
  totals: { pages: number; indexable: number; inSitemap: number; heldByGate: number; declaringQuery: number };
  measurement: PageMeasurement;
};

async function currentMeasurement(): Promise<PageMeasurement> {
  const health = await getGscHealth();

  // A demo snapshot is a fixture. Reporting it as measurement would put
  // invented numbers in front of whoever is deciding what to do next.
  if (health.provider !== "gsc-api" || !health.snapshot) {
    return {
      available: false,
      source: health.provider,
      reason: health.provider === "demo-gsc"
        ? "Search Console is running on a demo fixture. Its numbers are not real and are withheld on purpose."
        : (health.alerts[0]?.message ?? "Search Console is not connected."),
    };
  }

  return {
    available: true,
    source: health.provider,
    perUrl: false,
    impressions: health.snapshot.impressions,
    clicks: health.snapshot.clicks,
    submittedUrls: health.snapshot.submittedUrls,
    indexedUrls: health.snapshot.indexedUrls,
  };
}

function rowsFor(pages: SeoPage[], sitemapUrls: Set<string>, sitemapCounts: Map<string, number>): PageStatusRow[] {
  return pages.map((page) => {
    const quality = evaluateSeoPageQuality(page);
    return {
      path: page.path,
      canonicalUrl: page.canonicalUrl,
      indexable: page.indexability === "indexable",
      inSitemap: sitemapUrls.has(page.canonicalUrl),
      // A page in two segments is a duplicate-submission bug; a page in none
      // is silently uncrawlable. Both are visible here rather than silent.
      sitemapSegmentCount: sitemapCounts.get(page.canonicalUrl) ?? 0,
      gate: quality.status === "INDEX" ? "approved" : "held",
      gateReasons: quality.status === "HOLD" ? quality.reasons : [],
      ...(page.targetQuery ? { declaredQuery: page.targetQuery } : {}),
      ...(page.lastModified ? { lastModified: page.lastModified } : {}),
    };
  });
}

/** Build the status board. Safe to call with no credentials configured. */
export async function seoStatusBoard(): Promise<SeoStatusBoard> {
  const sitemapUrls = new Set<string>();
  const sitemapCounts = new Map<string, number>();

  for (const segment of SITEMAP_SEGMENTS) {
    for (const page of getSegmentPages(segment.id)) {
      sitemapUrls.add(page.canonicalUrl);
      sitemapCounts.set(page.canonicalUrl, (sitemapCounts.get(page.canonicalUrl) ?? 0) + 1);
    }
  }

  const pages = getPublishableSeoPages();
  const rows = rowsFor(pages, sitemapUrls, sitemapCounts);

  return {
    rows,
    totals: {
      pages: rows.length,
      indexable: rows.filter((row) => row.indexable).length,
      inSitemap: rows.filter((row) => row.inSitemap).length,
      heldByGate: rows.filter((row) => row.gate === "held").length,
      declaringQuery: rows.filter((row) => row.declaredQuery).length,
    },
    measurement: await currentMeasurement(),
  };
}
