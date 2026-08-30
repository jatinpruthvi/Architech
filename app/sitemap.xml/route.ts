/* Sitemap index at /sitemap.xml — the one URL advertised in robots.txt.

   This is a route handler rather than the `app/sitemap.ts` metadata convention
   because the index has to point at child sitemaps, and Next's
   `MetadataRoute.Sitemap` type can only describe `<urlset>` entries. */
import { buildSitemapIndex } from "@/lib/seo/sitemap";

/* Dynamic, for the same reason as the child sitemaps: the index advertises the
   newest date inside each one, so a baked copy would claim a date that is
   already wrong. */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(buildSitemapIndex(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
