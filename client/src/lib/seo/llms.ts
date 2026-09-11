/* llms.txt and llms-full.txt.
 *
 * READ THIS BEFORE TREATING EITHER FILE AS AN SEO WIN.
 *
 * `llms.txt` is a *proposed* convention: a Markdown index at the site root
 * telling an LLM agent which URLs matter and what each is for. As of this
 * writing no major AI vendor has publicly committed to reading it. It is
 * cheap, harmless, and plausibly useful; it is not a ranking mechanism, and
 * the normative architecture is explicit about that in three places —
 * `docs/architecture/normative/final-three-phase-architecture.md` §7.3, §13 and
 * the v5 decision register all say the same thing:
 *
 *   "`llms.txt` may be generated as an optional supplemental resource index.
 *    It must not replace HTML, XML sitemaps, canonical URLs, robots rules, or
 *    normal crawlable links."
 *
 * So this module is built to that rule. Everything here is DERIVED from the
 * same `SeoPage` registry the sitemap uses, through the same publishable
 * filter (registry-indexable AND quality-gate approved). Nothing is hand-
 * maintained, because a hand-maintained index is one that silently rots into
 * advertising 404s.
 *
 * The two files differ in kind, not degree:
 *
 *   - llms.txt      — an INDEX. URLs plus one line of orientation each. No
 *                     property facts. Safe whenever the site is indexable at
 *                     all, because it says nothing the sitemap does not.
 *   - llms-full.txt — a CORPUS. Concatenated content for direct ingestion.
 *                     This is a different risk object entirely and is gated
 *                     separately; see `isLlmsFullEnabled` below.
 *
 * Pure: no clock, no I/O, no request. */
import { sitemapSegmentForPage, type SeoPage } from "./pages";
import { isPublicIndexingEnabled, type RuntimeEnvironment } from "./runtime";
import { SITEMAP_SEGMENTS } from "./sitemap";
import { llmsFullTxtUrl, sitemapIndexUrl, sitemapSegmentUrl, siteUrl } from "./urls";

/** Second gate, on top of `PUBLIC_INDEXING_ENABLED`, for llms-full.txt only.
 *
 *  Why a separate flag rather than reusing the indexing gate:
 *
 *  `llms.txt` republishes URLs that are already in the sitemap — turning it on
 *  reveals nothing new. `llms-full.txt` republishes *content*, in the single
 *  most ingestible form there is: one flat text file, no markup, no rate
 *  limit, no rendering. For this project that content is currently
 *  ILLUSTRATIVE DEMO inventory — prices, availability and RERA badges that
 *  have not been through India Post / RERA verification. The repository's
 *  loudest standing rule is never to present invented property facts as real,
 *  and a full-text dump is the most confident possible way to break it.
 *
 *  There is also no undo. A page can be de-indexed; a corpus that has been
 *  ingested cannot be recalled.
 *
 *  So it fails closed twice, and the trigger to open it is written down:
 *  real verified inventory + LEG-003 (media rights) + LEG-008 (AI content)
 *  both cleared. Until then this returns false even in development, because
 *  a dev default of "on" is how a flag ends up on in production. */
export function isLlmsFullEnabled(env: RuntimeEnvironment = process.env): boolean {
  return isPublicIndexingEnabled(env) && env.ARCHITECH_LLMS_FULL_ENABLED === "true";
}

/** One line of orientation per segment — what a consumer would need to know to
    pick the right URL. Sourced from SITEMAP_SEGMENTS so the two files cannot
    describe the same corpus differently. */
function segmentHeading(id: string): { label: string; description: string } {
  const match = SITEMAP_SEGMENTS.find((segment) => segment.id === id);
  return match ? { label: match.label, description: match.description } : { label: id, description: "" };
}

function escapeMarkdownInline(value: string): string {
  /* Link labels are the only place registry prose lands inside Markdown
     syntax, so `[` and `]` are the characters that can break the structure.
     Everything else renders as intended. */
  return value.replace(/([[\]])/g, "\\$1");
}

/** A registry page as one Markdown link line. `primaryIntent` is the
    registry's own statement of what the page is for, so the description is
    the project's answer rather than a generated paraphrase. */
function pageLine(page: SeoPage): string {
  const label = escapeMarkdownInline(page.primaryIntent || page.path);
  const suffix = page.lastModified ? ` (updated ${page.lastModified})` : "";
  return `- [${label}](${page.canonicalUrl})${suffix}`;
}

export type LlmsTxtOptions = {
  /** Cap on links emitted per segment. The listings segment grows without
      bound as inventory lands, and an index that is 40,000 lines long is a
      corpus wearing an index's name — at which point a consumer should be
      reading the sitemap instead. Segments that overflow say so explicitly
      and point at their sitemap. */
  maxPerSegment?: number;
};

const DEFAULT_MAX_PER_SEGMENT = 200;

/** Build llms.txt from the publishable registry.
 *
 *  Empty (bar a one-line explanation) when indexing is gated off — the same
 *  fail-closed behaviour as `buildSegmentSitemap`. A preview deploy must not
 *  hand an agent a list of URLs that are all `noindex`. */
export function buildLlmsTxt(pages: SeoPage[], env: RuntimeEnvironment = process.env, options: LlmsTxtOptions = {}): string {
  const site = siteUrl();
  if (!isPublicIndexingEnabled(env)) {
    return [
      "# Architech",
      "",
      "Public indexing is disabled for this deployment, so no URLs are advertised here.",
      "",
      `See ${sitemapIndexUrl()} for the canonical index once indexing is enabled.`,
      "",
    ].join("\n");
  }

  const maxPerSegment = options.maxPerSegment ?? DEFAULT_MAX_PER_SEGMENT;
  const lines: string[] = [
    "# Architech",
    "",
    "> India-wide real-estate discovery. Property listings, locality guides and per-city",
    "> price indexes, organised city → locality → property. Every public page is",
    "> server-rendered HTML with schema.org structured data; this file is a supplemental",
    "> index of that same content, not a replacement for it.",
    "",
    "## About this file",
    "",
    `- Canonical sitemap index: ${sitemapIndexUrl()}`,
    `- Site: ${site}/`,
    "- Structured data: schema.org RealEstateListing, Place, City, Dataset, BreadcrumbList.",
    "- Only pages that pass the editorial quality gate are listed. Registry breadth is not index coverage.",
  ];

  if (isLlmsFullEnabled(env)) lines.push(`- Full-text corpus: ${llmsFullTxtUrl()}`);

  /* Property facts in this deployment may be illustrative. Saying so in the
     file itself is the only way the disclosure survives being scraped — a
     caveat that lives only in the HTML is lost the moment content is
     extracted, which is precisely what this file invites. */
  lines.push(
    "",
    "## Data provenance",
    "",
    "Listing prices, availability and verification badges are sourced from broker",
    "submissions and are re-verified on a published cadence. Facts carry visible source",
    "and date on the page itself; prefer the page over any cached copy of this file.",
  );

  for (const segment of SITEMAP_SEGMENTS) {
    const inSegment = pages.filter((page) => sitemapSegmentForPage(page) === segment.id);
    if (!inSegment.length) continue;
    const heading = segmentHeading(segment.id);
    lines.push("", `## ${heading.label}`, "", heading.description, "");
    for (const page of inSegment.slice(0, maxPerSegment)) lines.push(pageLine(page));
    if (inSegment.length > maxPerSegment) {
      lines.push(
        `- …and ${inSegment.length - maxPerSegment} more. Complete machine-readable list: ${sitemapSegmentUrl(segment.id)}`,
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

export type LlmsFullSection = {
  url: string;
  title: string;
  /** Plain-text body. Callers are responsible for it already being text —
      this module does not strip HTML, because a half-working stripper that
      leaks markup into a corpus is worse than no corpus. */
  body: string;
  lastModified?: string;
};

/** Build llms-full.txt from pre-extracted sections.
 *
 *  Returns the gated placeholder — never partial content — when the flag is
 *  off, so a misconfigured deploy publishes an explanation rather than a
 *  half-corpus. */
export function buildLlmsFullTxt(sections: LlmsFullSection[], env: RuntimeEnvironment = process.env): string {
  if (!isLlmsFullEnabled(env)) {
    return [
      "# Architech — full-text corpus",
      "",
      "This corpus is not published for this deployment.",
      "",
      "It is gated behind ARCHITECH_LLMS_FULL_ENABLED in addition to public indexing,",
      "because full-text republication of property facts requires verified inventory and",
      "cleared media-rights and AI-content review. Until then the per-page HTML at",
      `${sitemapIndexUrl()} is the authoritative source.`,
      "",
    ].join("\n");
  }

  const header = [
    "# Architech — full-text corpus",
    "",
    `Source: ${siteUrl()}/`,
    `Sections: ${sections.length}`,
    "",
    "Each section below is delimited by a level-2 heading carrying the canonical URL.",
    "Facts are as published on the page at generation time; the page is authoritative.",
    "",
  ];

  const body = sections.map((section) => {
    const meta = section.lastModified ? `\nUpdated: ${section.lastModified}` : "";
    return [`## ${section.title}`, `URL: ${section.url}${meta}`, "", section.body.trim(), ""].join("\n");
  });

  return [...header, ...body].join("\n");
}
