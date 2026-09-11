/* /sitemap/images.xml — image sitemap.
 *
 * A STATIC route segment sitting alongside the `[segment]` dynamic route.
 * Next.js resolves static segments before dynamic ones, so this handler wins
 * for `images.xml` and `[segment]` continues to serve the page sitemaps. The
 * `images` id is deliberately NOT added to SITEMAP_SEGMENTS: those are page
 * segments over the SeoPage registry, and this enumerates media instead. The
 * registry's own "every page lands in exactly one child sitemap" invariant
 * would break if a media sitemap were folded into that set.
 *
 * It is advertised from the sitemap index like any other child sitemap. */
import { buildImageSitemap } from "@/lib/seo/image-sitemap";
import { getPublishableSeoPagesForServer } from "@/lib/seo/pages-server";
import { getListingsForServer, MAX_UNSCOPED_LISTING_ROWS } from "@/lib/repositories/server/prisma";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  let body: string;
  try {
    const [pages, listings] = await Promise.all([
      getPublishableSeoPagesForServer(),
      getListingsForServer({ limit: MAX_UNSCOPED_LISTING_ROWS }),
    ]);
    /* The publishable set is the authority on what may be advertised. Page ids
       are `listing:{id}` (see lib/seo/pages.ts), so the prefix strip below is
       coupled to that convention — the contract test pins it. */
    const publishableListingIds = new Set(
      pages.filter((page) => page.id.startsWith("listing:")).map((page) => page.id.slice("listing:".length)),
    );
    body = buildImageSitemap(listings, publishableListingIds, process.env);
  } catch (error) {
    /* Same failure posture as the page sitemaps: an empty sitemap is a
       recoverable ops problem, advertising media for pages that may not be
       publishable is a trust problem. */
    logger.error({ event: "seo.image_sitemap_failed", error }, "image sitemap composition failed; serving an empty urlset");
    body = buildImageSitemap([], new Set(), process.env);
  }
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
