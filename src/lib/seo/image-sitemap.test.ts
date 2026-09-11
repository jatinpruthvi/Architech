import { describe, expect, it } from "vitest";
import { buildImageSitemap, renderImageSitemapXml, resolveImageUrl, toImageSitemapEntries } from "./image-sitemap";
import { properties, type Property } from "@/lib/properties";
import { getPublishableSeoPages } from "./pages";
import { imageSitemapPath } from "./urls";
import { buildSitemapIndex } from "./sitemap";

/* The contract that matters: an image sitemap advertises fetchable media for
   pages that are actually publishable. These tests exist to catch the ways
   that breaks — advertising media for a held-back page, emitting a relative
   URL a crawler cannot resolve, and duplicating the hero photo. */

const INDEXING_ON = { NODE_ENV: "production", PUBLIC_INDEXING_ENABLED: "true" } as const;
const INDEXING_OFF = { NODE_ENV: "production" } as const;

const publishableListingIds = new Set(
  getPublishableSeoPages()
    .filter((page) => page.id.startsWith("listing:"))
    .map((page) => page.id.slice("listing:".length)),
);

const base = "https://example.com";

function listing(overrides: Partial<Property>): Property {
  return { ...properties[0], ...overrides };
}

describe("media url resolution", () => {
  it("passes an absolute URL through unchanged", () => {
    expect(resolveImageUrl("https://cdn.example.com/a.jpg", base)).toBe("https://cdn.example.com/a.jpg");
  });

  it("resolves a fixture asset key to an absolute site URL", () => {
    expect(resolveImageUrl("prop-courtyard", base)).toBe("https://example.com/images/prop-courtyard.jpg");
  });

  it("drops a relative path rather than guessing at it", () => {
    // A sitemap advertising an unfetchable image is worse than one omitting it.
    expect(resolveImageUrl("/images/prop-courtyard.jpg", base)).toBeUndefined();
  });

  it("drops empty input", () => {
    expect(resolveImageUrl(undefined, base)).toBeUndefined();
    expect(resolveImageUrl("", base)).toBeUndefined();
  });
});

describe("entry construction", () => {
  it("advertises media only for publishable listings", () => {
    const entries = toImageSitemapEntries(properties, publishableListingIds, base);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const id = entry.loc.replace(/.*\/listing\//, "").replace(/\/$/, "");
      expect(publishableListingIds.has(id)).toBe(true);
    }
  });

  it("emits nothing for a listing the quality gate held back", () => {
    expect(toImageSitemapEntries(properties, new Set(), base)).toEqual([]);
  });

  it("prefers the absolute data-source URL over the fixture key", () => {
    const target = listing({ id: "x", image: "prop-light", imageUrl: "https://cdn.example.com/real.jpg" });
    const [entry] = toImageSitemapEntries([target], new Set(["x"]), base);
    expect(entry.images[0].loc).toBe("https://cdn.example.com/real.jpg");
  });

  it("includes gallery photographs after the primary", () => {
    const target = listing({ id: "x", image: "prop-light", gallery: ["prop-thaltej", "brick-arch"] });
    const [entry] = toImageSitemapEntries([target], new Set(["x"]), base);
    expect(entry.images.map((image) => image.loc)).toEqual([
      "https://example.com/images/prop-light.jpg",
      "https://example.com/images/prop-thaltej.jpg",
      "https://example.com/images/brick-arch.jpg",
    ]);
  });

  it("de-duplicates a gallery that repeats the hero photo", () => {
    const target = listing({ id: "x", image: "prop-light", gallery: ["prop-light", "prop-thaltej"] });
    const [entry] = toImageSitemapEntries([target], new Set(["x"]), base);
    expect(entry.images).toHaveLength(2);
  });

  it("skips a listing whose media cannot be resolved", () => {
    const target = listing({ id: "x", image: "", imageUrl: undefined, gallery: [] });
    expect(toImageSitemapEntries([target], new Set(["x"]), base)).toEqual([]);
  });

  it("carries per-listing title and caption, not templated filler", () => {
    const target = listing({ id: "x", image: "prop-light", title: "Light across every room", note: "Morning sun." });
    const [entry] = toImageSitemapEntries([target], new Set(["x"]), base);
    expect(entry.images[0].title).toBe("Light across every room");
    expect(entry.images[0].caption).toBe("Morning sun.");
  });

  it("omits the caption when the listing carries no note", () => {
    const target = listing({ id: "x", image: "prop-light", note: "" });
    const [entry] = toImageSitemapEntries([target], new Set(["x"]), base);
    expect(entry.images[0].caption).toBeUndefined();
  });
});

describe("xml rendering", () => {
  it("declares the image namespace", () => {
    const xml = renderImageSitemapXml([{ loc: "https://example.com/listing/a/", images: [{ loc: "https://example.com/a.jpg" }] }]);
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toContain("<image:loc>https://example.com/a.jpg</image:loc>");
  });

  it("escapes titles so a hostile listing cannot emit invalid XML", () => {
    const xml = renderImageSitemapXml([
      { loc: "https://example.com/listing/a/", images: [{ loc: "https://example.com/a.jpg", title: 'Tom & "Jerry" <b>' }] },
    ]);
    expect(xml).toContain("Tom &amp; &quot;Jerry&quot; &lt;b&gt;");
    expect(xml).not.toContain("<b>");
  });

  it("omits optional child elements rather than emitting empty ones", () => {
    const xml = renderImageSitemapXml([{ loc: "https://example.com/listing/a/", images: [{ loc: "https://example.com/a.jpg" }] }]);
    expect(xml).not.toContain("<image:title>");
    expect(xml).not.toContain("<image:caption>");
  });
});

describe("indexing gate", () => {
  it("advertises nothing while public indexing is gated off", () => {
    const xml = buildImageSitemap(properties, publishableListingIds, INDEXING_OFF, base);
    expect(xml).toContain("<urlset");
    expect(xml).not.toContain("<image:image>");
  });

  it("advertises media once indexing is on", () => {
    expect(buildImageSitemap(properties, publishableListingIds, INDEXING_ON, base)).toContain("<image:image>");
  });
});

describe("sitemap index integration", () => {
  it("advertises the image sitemap from the index", () => {
    // A child sitemap nothing points at is a child sitemap nothing crawls.
    expect(buildSitemapIndex(INDEXING_ON)).toContain(imageSitemapPath());
  });

  it("keeps the image sitemap out of the index while indexing is gated off", () => {
    expect(buildSitemapIndex(INDEXING_OFF)).not.toContain(imageSitemapPath());
  });
});
