import { describe, expect, it } from "vitest";
import { assetUrl, brokerListingNewUrl, canonicalUrl, cityUrl, guideUrl, homeUrl, listingUrl, localityUrl, normalizeSiteUrl, privacyUrl, savedSearchesUrl, savedUrl, searchUrl, sitemapIndexPath, sitemapIndexUrl, sitemapSegmentPath, sitemapSegmentUrl, termsUrl, withTrailingSlash } from "./urls";

const base = "https://example.com/";

describe("canonical URL helpers", () => {
  it("normalizes configured site URLs", () => {
    expect(normalizeSiteUrl("https://example.com///")).toBe("https://example.com");
    expect(normalizeSiteUrl("https://example.com/root/")).toBe("https://example.com/root");
    expect(normalizeSiteUrl("not a url")).toBe("https://architech-demo.example.com");
  });

  it("enforces trailing slash route paths", () => {
    expect(withTrailingSlash("/")).toBe("/");
    expect(withTrailingSlash("/buy/ahmedabad")).toBe("/buy/ahmedabad/");
    expect(withTrailingSlash("listing/garden-courtyard/")).toBe("/listing/garden-courtyard/");
  });

  it("builds stable absolute canonical URLs", () => {
    expect(homeUrl(base)).toBe("https://example.com/");
    expect(cityUrl("ahmedabad", "buy", base)).toBe("https://example.com/buy/ahmedabad/");
    expect(localityUrl("ahmedabad", "paldi", "buy", base)).toBe("https://example.com/buy/ahmedabad/paldi/");
    expect(listingUrl("garden-courtyard", base)).toBe("https://example.com/listing/garden-courtyard/");
    expect(guideUrl(undefined, base)).toBe("https://example.com/guide/");
    expect(searchUrl(base)).toBe("https://example.com/search/");
    expect(savedUrl(base)).toBe("https://example.com/saved/");
    expect(canonicalUrl("buy/ahmedabad", base)).toBe("https://example.com/buy/ahmedabad/");
  });

  it("self-canonicalises noindex utility pages instead of claiming the homepage", () => {
    /* A canonical is an identity statement; privacy/terms/saved-searches/draft
       pages are noindex, but a noindex page canonicalising to `/` publishes a
       false identity. Self-referencing keeps the statement true. */
    expect(privacyUrl(base)).toBe("https://example.com/privacy/");
    expect(termsUrl(base)).toBe("https://example.com/terms/");
    expect(savedSearchesUrl(base)).toBe("https://example.com/saved-searches/");
    expect(brokerListingNewUrl(base)).toBe("https://example.com/broker/listings/new/");
  });

  it("builds absolute asset and sitemap URLs without route slash mutation", () => {
    expect(assetUrl("/images/hero-ahmedabad.jpg", base)).toBe("https://example.com/images/hero-ahmedabad.jpg");
    expect(sitemapIndexPath()).toBe("/sitemap.xml");
    expect(sitemapIndexUrl(base)).toBe("https://example.com/sitemap.xml");
    expect(sitemapSegmentPath("localities")).toBe("/sitemap/localities.xml");
    expect(sitemapSegmentUrl("localities", base)).toBe("https://example.com/sitemap/localities.xml");
  });
});
