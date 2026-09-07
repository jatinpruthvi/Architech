/* /llms.txt — supplemental resource index for LLM agents.
 *
 * Served from the root with a dotted filename because that is the entire
 * convention: a consumer guesses the URL. Content type is text/plain (the
 * convention's Markdown is plain text on the wire) so a browser shows it
 * rather than downloading it.
 *
 * Dynamic for the same reason the sitemaps are: the payload depends on
 * PUBLIC_INDEXING_ENABLED and on live inventory, and a prerender bakes
 * whichever values were set at build time. */
import { buildLlmsTxt } from "@/lib/seo/llms";
import { getPublishableSeoPagesForServer } from "@/lib/seo/pages-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const pages = await getPublishableSeoPagesForServer();
  return new Response(buildLlmsTxt(pages, process.env), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
