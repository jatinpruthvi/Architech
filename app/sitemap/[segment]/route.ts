/* One child sitemap per content type: /sitemap/pages.xml, /sitemap/cities.xml,
   /sitemap/localities.xml, /sitemap/listings.xml, /sitemap/guides.xml.

   Requests for an unknown segment get a real 404 rather than an empty 200, so a
   typo in the index surfaces as a Search Console error instead of silently
   submitting nothing. */
import { notFound } from "next/navigation";
import { buildSegmentSitemap, isSitemapSegment } from "@/lib/seo/sitemap";
import type { SeoSitemapSegment } from "@/lib/seo/pages";

/* Dynamic, not prerendered.

   This was `force-static`, which meant a listing approved at 10am did not
   appear until the next build — and Google's first signal that a URL exists
   is the sitemap.

   It is `force-dynamic` rather than ISR on purpose. The payload depends on
   `PUBLIC_INDEXING_ENABLED`, and a prerender bakes whatever that flag was at
   build time: build without it and you ship an empty sitemap that stays empty
   until something revalidates it. That failure is silent, invisible in the
   diff, and costs a week of indexing. Rendering per request removes the whole
   class of bug. The response is still cached at the edge for an hour by the
   `s-maxage` below, so the cost is one render per CDN region per hour. */
export const dynamic = "force-dynamic";



export async function GET(_request: Request, context: { params: Promise<{ segment: string }> }) {
  const { segment } = await context.params;
  const id = segment.replace(/\.xml$/, "");
  if (!isSitemapSegment(id)) notFound();
  return new Response(buildSegmentSitemap(id as SeoSitemapSegment), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
