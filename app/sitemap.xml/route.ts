/* Sitemap index at /sitemap.xml — the one URL advertised in robots.txt.

   This is a route handler rather than the `app/sitemap.ts` metadata convention
   because the index has to point at child sitemaps, and Next's
   `MetadataRoute.Sitemap` type can only describe `<urlset>` entries. */
import { buildSitemapIndex } from "@/lib/seo/sitemap";
import { getPublishableSeoPagesForServer } from "@/lib/seo/pages-server";

/* The index is composed from the LIVE data mode's publishable set: under
   prisma the fixture registry must not be advertised (D5-04 — fixture URLs
   the prisma-built graph does not render are orphan submissions). */

/* Dynamic, for the same reason as the child sitemaps: the index advertises the
   newest date inside each one, so a baked copy would claim a date that is
   already wrong. */
export const dynamic = "force-dynamic";

export async function GET() {
  const pages = await getPublishableSeoPagesForServer();
  return new Response(buildSitemapIndex(process.env, pages), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
