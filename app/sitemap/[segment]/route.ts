/* One child sitemap per content type: /sitemap/pages.xml, /sitemap/cities.xml,
   /sitemap/localities.xml, /sitemap/listings.xml, /sitemap/guides.xml.

   Requests for an unknown segment get a real 404 rather than an empty 200, so a
   typo in the index surfaces as a Search Console error instead of silently
   submitting nothing. */
import { notFound } from "next/navigation";
import { SITEMAP_SEGMENTS, buildSegmentSitemap, isSitemapSegment } from "@/lib/seo/sitemap";
import type { SeoSitemapSegment } from "@/lib/seo/pages";

/* Prerendered, not frozen.

   This was `force-static`, which meant a listing approved at 10am did not
   appear in the sitemap until the next build — Google's first signal that a
   URL exists is the sitemap, so a stale one quietly withholds every new page.
   `revalidate` keeps the build-time prerender and adds a one-hour floor, while
   the discovery subscriber calls `revalidatePath` the moment something
   publishes. */
export const revalidate = 3600;

export function generateStaticParams() {
  return SITEMAP_SEGMENTS.map((segment) => ({ segment: `${segment.id}.xml` }));
}

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
