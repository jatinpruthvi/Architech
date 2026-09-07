import { describe, expect, it } from "vitest";
import { buildLlmsFullTxt, buildLlmsTxt, isLlmsFullEnabled } from "./llms";
import { getPublishableSeoPages, type SeoPage } from "./pages";
import { SITEMAP_SEGMENTS } from "./sitemap";

/* The contract that matters: llms.txt is a SUPPLEMENTAL INDEX derived from the
   same publishable registry as the sitemap, and llms-full.txt is a corpus
   behind a second gate. These tests exist to catch the ways that breaks — the
   index advertising a page the quality gate held back, either file leaking
   content while indexing is off, and llms-full opening on one gate. */

const INDEXING_ON = { NODE_ENV: "production", PUBLIC_INDEXING_ENABLED: "true" } as const;
const INDEXING_OFF = { NODE_ENV: "production" } as const;
const FULL_ON = { ...INDEXING_ON, ARCHITECH_LLMS_FULL_ENABLED: "true" } as const;

const pages = getPublishableSeoPages();

describe("llms.txt", () => {
  it("advertises nothing while public indexing is gated off", () => {
    const output = buildLlmsTxt(pages, INDEXING_OFF);
    expect(output).toContain("Public indexing is disabled");
    /* The decisive assertion: no page URL leaks through. The home page is
       skipped because its canonical IS the bare origin, which is a substring
       of the sitemap URL the placeholder deliberately keeps — asserting on it
       would fail on the one URL that is meant to be there. */
    for (const page of pages) {
      if (page.routeType === "home") continue;
      expect(output).not.toContain(page.canonicalUrl);
    }
    expect(output).not.toContain("/listing/");
  });

  it("names the site and points at the canonical sitemap", () => {
    const output = buildLlmsTxt(pages, INDEXING_ON);
    expect(output.startsWith("# Architech")).toBe(true);
    expect(output).toContain("/sitemap.xml");
  });

  it("lists published pages under their sitemap segment heading", () => {
    const output = buildLlmsTxt(pages, INDEXING_ON);
    for (const segment of SITEMAP_SEGMENTS) {
      const hasPages = pages.some((page) => (page.sitemapSegment ?? "") === segment.id || output.includes(segment.label));
      if (hasPages) expect(output).toContain(segment.label);
    }
  });

  it("advertises only pages the quality gate cleared", () => {
    // Same authority as the sitemap: this file must never widen the surface.
    const output = buildLlmsTxt(pages, INDEXING_ON);
    const publishable = new Set(pages.map((page) => page.canonicalUrl));
    const advertised = [...output.matchAll(/\]\((https?:[^)]+)\)/g)].map((match) => match[1]);
    expect(advertised.length).toBeGreaterThan(0);
    for (const url of advertised) {
      if (url.endsWith(".xml") || url.endsWith(".txt")) continue;
      expect(publishable.has(url)).toBe(true);
    }
  });

  it("states data provenance inside the file itself", () => {
    // A caveat that lives only in the HTML is lost the moment content is
    // extracted — which is exactly what this file invites.
    expect(buildLlmsTxt(pages, INDEXING_ON)).toContain("## Data provenance");
  });

  it("does not advertise the full corpus unless that gate is open too", () => {
    expect(buildLlmsTxt(pages, INDEXING_ON)).not.toContain("/llms-full.txt");
    expect(buildLlmsTxt(pages, FULL_ON)).toContain("/llms-full.txt");
  });

  it("truncates an oversized segment and points at the sitemap instead", () => {
    // An index that is 40,000 lines long is a corpus wearing an index's name.
    const many: SeoPage[] = Array.from({ length: 12 }, (_, index) => ({
      ...pages[0],
      id: `listing:bulk-${index}`,
      routeType: "listing",
      canonicalUrl: `https://example.com/listing/bulk-${index}/`,
      path: `/listing/bulk-${index}/`,
    }));
    const output = buildLlmsTxt(many, INDEXING_ON, { maxPerSegment: 5 });
    expect(output).toContain("…and 7 more");
    expect(output).toContain("/sitemap/listings.xml");
    expect(output).toContain("bulk-4");
    expect(output).not.toContain("bulk-11");
  });

  it("escapes bracket characters so registry prose cannot break link syntax", () => {
    const hostile: SeoPage[] = [{ ...pages[0], primaryIntent: "Buy [now] in Paldi" }];
    const output = buildLlmsTxt(hostile, INDEXING_ON);
    expect(output).toContain("Buy \\[now\\] in Paldi");
  });

  it("emits a trailing newline", () => {
    expect(buildLlmsTxt(pages, INDEXING_ON).endsWith("\n")).toBe(true);
  });
});

describe("llms-full.txt gating", () => {
  it("stays closed on the indexing gate alone", () => {
    expect(isLlmsFullEnabled(INDEXING_ON)).toBe(false);
  });

  it("stays closed on its own flag alone", () => {
    // Both gates, in both directions — this is the whole point of the second flag.
    expect(isLlmsFullEnabled({ ...INDEXING_OFF, ARCHITECH_LLMS_FULL_ENABLED: "true" })).toBe(false);
  });

  it("opens only when both gates are set", () => {
    expect(isLlmsFullEnabled(FULL_ON)).toBe(true);
  });

  it("stays closed in development, where indexing is implicitly on", () => {
    // A dev default of "on" is how a flag ends up on in production.
    expect(isLlmsFullEnabled({ NODE_ENV: "development" })).toBe(false);
  });

  it("publishes an explanation, never partial content, when gated off", () => {
    const sections = [{ url: "https://example.com/listing/a/", title: "A", body: "SECRET BODY TEXT" }];
    const output = buildLlmsFullTxt(sections, INDEXING_ON);
    expect(output).toContain("not published for this deployment");
    expect(output).not.toContain("SECRET BODY TEXT");
  });

  it("emits delimited sections carrying canonical URLs when open", () => {
    const sections = [
      { url: "https://example.com/listing/a/", title: "A courtyard in Paldi", body: "Body one.", lastModified: "2026-08-24" },
      { url: "https://example.com/listing/b/", title: "Light in Prahlad Nagar", body: "Body two." },
    ];
    const output = buildLlmsFullTxt(sections, FULL_ON);
    expect(output).toContain("Sections: 2");
    expect(output).toContain("## A courtyard in Paldi");
    expect(output).toContain("URL: https://example.com/listing/a/");
    expect(output).toContain("Updated: 2026-08-24");
    expect(output).toContain("Body two.");
    // A section with no date omits the line rather than inventing one.
    expect(output).not.toContain("Updated: undefined");
  });
});
