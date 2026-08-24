import { describe, expect, it } from "vitest";
import { assetUrl, canonicalUrl, cityUrl, guideUrl, homeUrl, listingUrl, localityUrl, normalizeSiteUrl, savedUrl, searchUrl, sitemapUrl, withTrailingSlash } from "./urls";

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

  it("builds absolute asset and sitemap URLs without route slash mutation", () => {
    expect(assetUrl("/images/hero-ahmedabad.jpg", base)).toBe("https://example.com/images/hero-ahmedabad.jpg");
    expect(sitemapUrl(base)).toBe("https://example.com/sitemap.xml");
  });
});
