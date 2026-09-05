import { describe, expect, it } from "vitest";
import { r2ImageLoader, r2TransformUrl } from "./image-loader";

/* Phase 3 of the media decision: R2 originals are served through Cloudflare
   Image Transformations URLs, never through the app origin. */

const BASE = "https://media.architech.example.com";

describe("r2TransformUrl", () => {
  it("rewrites an R2 object URL to a transformation URL", () => {
    expect(r2TransformUrl(`${BASE}/listing-drafts/draft_1/media_1/courtyard-hero.jpg`, 800, BASE)).toBe(
      `${BASE}/img/800-auto/listing-drafts/draft_1/media_1/courtyard-hero.jpg`,
    );
  });

  it("tolerates a trailing slash on the base", () => {
    expect(r2TransformUrl(`${BASE}/a/b.jpg`, 320, `${BASE}/`)).toBe(`${BASE}/img/320-auto/a/b.jpg`);
  });

  it("leaves relative (app-local) URLs alone", () => {
    expect(r2TransformUrl("/images/courtyard-hero.webp", 800, BASE)).toBeNull();
  });

  it("leaves foreign origins alone", () => {
    expect(r2TransformUrl("https://other.example.com/a.jpg", 800, BASE)).toBeNull();
  });

  it("does not treat a longer, sibling domain as the R2 base", () => {
    expect(r2TransformUrl("https://media.architech.example.com.evil.test/a.jpg", 800, BASE)).toBeNull();
  });

  it("clamps absurd widths instead of emitting them", () => {
    expect(r2TransformUrl(`${BASE}/a.jpg`, 4, BASE)).toBe(`${BASE}/img/1024-auto/a.jpg`);
    expect(r2TransformUrl(`${BASE}/a.jpg`, 99999, BASE)).toBe(`${BASE}/img/4096-auto/a.jpg`);
    expect(r2TransformUrl(`${BASE}/a.jpg`, 0, BASE)).toBe(`${BASE}/img/1024-auto/a.jpg`);
  });

  it("returns null for an empty base or a bare base URL", () => {
    expect(r2TransformUrl(`${BASE}/a.jpg`, 800, "")).toBeNull();
    expect(r2TransformUrl(BASE, 800, BASE)).toBeNull();
  });
});

describe("r2ImageLoader (next/image custom loader)", () => {
  it("passes non-R2 URLs through unchanged", () => {
    expect(r2ImageLoader("/images/hero.jpg", 1600, BASE)).toBe("/images/hero.jpg");
    expect(r2ImageLoader("https://other.example.com/x.jpg", 800, BASE)).toBe("https://other.example.com/x.jpg");
  });

  it("transforms R2 URLs with the requested width", () => {
    expect(r2ImageLoader(`${BASE}/listing-drafts/d/x.jpg`, 480, BASE)).toBe(`${BASE}/img/480-auto/listing-drafts/d/x.jpg`);
  });
});
