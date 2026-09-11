/* /llms-full.txt — full-text corpus for LLM ingestion.
 *
 * Gated behind ARCHITECH_LLMS_FULL_ENABLED **in addition to**
 * PUBLIC_INDEXING_ENABLED. See `lib/seo/llms.ts` for why the second gate
 * exists: this file republishes property facts in the most ingestible form
 * available, the current inventory is unverified demo data, and ingestion has
 * no undo.
 *
 * When the flag is off the route still answers 200 with an explanation rather
 * than 404. A 404 reads as "this site has no such file" and invites a retry;
 * an explanation records a deliberate decision, which is what it is.
 *
 * The corpus is assembled from registry metadata only — `primaryIntent`,
 * `freshnessPolicy` and the declared target query — NOT from rendered page
 * HTML. That is a deliberate limit: extracting body text would mean shipping
 * an HTML-to-text stripper whose failure mode is leaking markup and
 * navigation chrome into a corpus. Registry prose is already plain text and
 * already reviewed. Widening this to real page bodies is a follow-up that
 * should land with the verified-inventory work, not before it. */
import { buildLlmsFullTxt, isLlmsFullEnabled, type LlmsFullSection } from "@/lib/seo/llms";
import { getPublishableSeoPagesForServer } from "@/lib/seo/pages-server";

export const dynamic = "force-dynamic";

export async function GET() {
  /* Skip the registry composition entirely when gated off — no reason to hit
     the database to render a fixed placeholder. */
  if (!isLlmsFullEnabled(process.env)) {
    return new Response(buildLlmsFullTxt([], process.env), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" },
    });
  }

  const pages = await getPublishableSeoPagesForServer();
  const sections: LlmsFullSection[] = pages.map((page) => ({
    url: page.canonicalUrl,
    title: page.primaryIntent || page.path,
    lastModified: page.lastModified,
    body: [page.primaryIntent, page.targetQuery ? `Answers: ${page.targetQuery}` : "", `Freshness: ${page.freshnessPolicy}`]
      .filter(Boolean)
      .join("\n"),
  }));

  return new Response(buildLlmsFullTxt(sections, process.env), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
