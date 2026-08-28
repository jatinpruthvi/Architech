import { getIndexableSeoPages, type SeoPage } from "@/lib/seo/pages";
import { sitemapUrl } from "@/lib/seo/urls";

export type SearchConsoleThresholds = {
  minIndexedRatio: number;
  maxSitemapErrors: number;
  maxCoverageErrors: number;
  maxClickDropRatio: number;
};

export type SearchConsoleSnapshot = {
  date: string;
  submittedUrls: number;
  indexedUrls: number;
  excludedUrls: number;
  clicks: number;
  impressions: number;
  sitemapErrors: number;
  coverageErrors: number;
};

export type SeoAlert = {
  level: "info" | "warning" | "critical";
  type: "index_coverage" | "sitemap" | "coverage_errors" | "click_drop" | "setup";
  message: string;
};

export const defaultSearchConsoleThresholds: SearchConsoleThresholds = {
  minIndexedRatio: 0.85,
  maxSitemapErrors: 0,
  maxCoverageErrors: 0,
  maxClickDropRatio: 0.35,
};

export function indexedRatio(snapshot: SearchConsoleSnapshot): number {
  if (snapshot.submittedUrls <= 0) return 0;
  return snapshot.indexedUrls / snapshot.submittedUrls;
}

export function analyzeSearchConsoleSnapshot(
  current: SearchConsoleSnapshot,
  previous?: SearchConsoleSnapshot,
  thresholds: SearchConsoleThresholds = defaultSearchConsoleThresholds,
): SeoAlert[] {
  const alerts: SeoAlert[] = [];
  const ratio = indexedRatio(current);

  if (ratio < thresholds.minIndexedRatio) {
    alerts.push({
      level: "warning",
      type: "index_coverage",
      message: `Indexed ratio ${(ratio * 100).toFixed(1)}% is below ${(thresholds.minIndexedRatio * 100).toFixed(0)}% target.`,
    });
  }

  if (current.sitemapErrors > thresholds.maxSitemapErrors) {
    alerts.push({ level: "critical", type: "sitemap", message: `${current.sitemapErrors} sitemap error(s) reported.` });
  }

  if (current.coverageErrors > thresholds.maxCoverageErrors) {
    alerts.push({ level: "critical", type: "coverage_errors", message: `${current.coverageErrors} coverage error(s) reported.` });
  }

  if (previous && previous.clicks > 0) {
    const dropRatio = (previous.clicks - current.clicks) / previous.clicks;
    if (dropRatio > thresholds.maxClickDropRatio) {
      alerts.push({ level: "warning", type: "click_drop", message: `Clicks dropped ${(dropRatio * 100).toFixed(1)}% vs previous snapshot.` });
    }
  }

  if (alerts.length === 0) alerts.push({ level: "info", type: "setup", message: "Search Console snapshot is within Phase 1 thresholds." });
  return alerts;
}

export function buildSearchConsoleSetup(siteUrl: string, sitemap = sitemapUrl()) {
  return [
    `Create a Google Search Console Domain property for ${new URL(siteUrl).hostname}.`,
    "Verify ownership using DNS TXT record at the domain registrar/DNS host.",
    `Submit sitemap: ${sitemap}.`,
    "Run URL Inspection on the home page, the /buy/ national hub, one city hub, one locality page, and one listing page.",
    "Export first baseline snapshot after Google discovers the sitemap.",
  ];
}

export function getIndexableCoverageSnapshot(pages: SeoPage[] = getIndexableSeoPages()) {
  return {
    indexablePageCount: pages.length,
    routeTypes: pages.reduce<Record<string, number>>((acc, page) => {
      acc[page.routeType] = (acc[page.routeType] ?? 0) + 1;
      return acc;
    }, {}),
    canonicalUrls: pages.map((page) => page.canonicalUrl),
  };
}
