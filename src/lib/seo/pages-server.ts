import "server-only";

/* Prisma-backed composition of the SEO page registry (D5-04, M-1 slice).
 *
 * Why this file exists: `lib/seo/pages.ts` is import-sync — it evaluates the
 * registry from the fixture repositories at module load, and the sitemap
 * route handlers used to copy exactly that. Under ARCHITECH_DATA_SOURCE=
 * prisma the sitemap therefore advertised fixture URLs the database graph
 * does not render — orphan URLs, and with PUBLIC_INDEXING_ENABLED flipped,
 * orphan URLs submitted to Google.
 *
 * These helpers build the registry from the SAME `buildSeoPages` composer
 * over the SAME per-source repositories every other server surface already
 * uses, and adjudicate it with the quality gate fed the SAME listing rows.
 *
 * Failure is empty, loud, and correct-by-construction: a prisma failure under
 * an indexing-enabled candidate yields an EMPTY sitemap and a logged error —
 * never the fixture corpus standing in for the database, because "nobody
 * indexes anything this deploy" is a recoverable ops problem while "Google
 * crawls 400 URLs that 404" is a trust problem.
 */
import {
  getAgentDirectoryForServer,
  getCitiesForServer,
  getListingsForServer,
  getLocalitiesForServer,
  MAX_UNSCOPED_LISTING_ROWS,
} from "@/lib/repositories/server/prisma";
import { isPrismaDataSource } from "@/lib/repositories/source";
import { logger } from "@/lib/observability/logger";
import { buildSeoPageQualityMap, buildSeoPages, getPublishableSeoPages, seoPages, type SeoPage } from "./pages";
import type { PageQualityDecision } from "./page-quality";

export type ServerSeoRegistry = {
  pages: SeoPage[];
  /** Quality map computed against the same evidence set as `pages`. */
  qualityMap: ReadonlyMap<string, PageQualityDecision>;
  /** Which corpus the registry was built from — for ops inspection only. */
  source: "fixture" | "prisma" | "prisma-empty-after-failure";
};

const fixtures: ServerSeoRegistry = {
  pages: seoPages,
  qualityMap: buildSeoPageQualityMap(seoPages),
  source: "fixture",
};

/* The registry changes when data changes — listings publish, localities land.
   A RequestMemo is wrong (publish → sitemap must move on the SAME deploy, and
   route handlers are dynamic); a never-expiring module cache is wrong too
   (a listing approved at 10am would never reach the sitemap until restart).
   A short TTL splits it: sitemap fetches share one composition per minute. */
const REGISTRY_TTL_MS = Number(process.env.SEO_REGISTRY_TTL_MS ?? 60_000);
let cached: { registry: ServerSeoRegistry; expiresAt: number } | null = null;

export async function getServerSeoRegistry(): Promise<ServerSeoRegistry> {
  if (!isPrismaDataSource()) return fixtures;
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.registry;
  try {
    const [cities, localities, listings, agents] = await Promise.all([
      getCitiesForServer(),
      getLocalitiesForServer(),
      getListingsForServer({ limit: MAX_UNSCOPED_LISTING_ROWS }),
      getAgentDirectoryForServer(),
    ]);
    /* ACTIVE only — the composer applies the same lifecycle gate the fixture
       corpus encodes (fixture `getListings()` is all-ACTIVE by construction;
       a prisma row count must never pull a DRAFT into the registry). */
    const active = listings.filter((listing) => (listing.lifecycle ?? "ACTIVE") === "ACTIVE");
    const pages = buildSeoPages({ cities, localities, listings: active, agents });
    const qualityMap = buildSeoPageQualityMap(pages, { listings: active, localities });
    const registry: ServerSeoRegistry = { pages, qualityMap, source: "prisma" };
    cached = { registry, expiresAt: now + REGISTRY_TTL_MS };
    return registry;
  } catch (error) {
    logger.error({ event: "seo.registry_prisma_failed", error }, "prisma SEO registry composition failed; serving an EMPTY sitemap rather than the fixture corpus");
    /* Deliberately NOT cached: a transient blip must clear on the next
       request, and $queryRaw errors during a migration window should not
       empty the sitemap for a whole TTL. */
    return { pages: [], qualityMap: new Map(), source: "prisma-empty-after-failure" };
  }
}

/** Publishable (registry-indexable AND quality-approved) pages for the live
    data mode — what the sitemap handlers must enumerate. */
export async function getPublishableSeoPagesForServer(): Promise<SeoPage[]> {
  const registry = await getServerSeoRegistry();
  return getPublishableSeoPages(registry.pages, registry.qualityMap);
}

/** Test hook: drop the TTL cache without touching module state elsewhere. */
export function resetServerSeoRegistryCache(): void {
  cached = null;
}
