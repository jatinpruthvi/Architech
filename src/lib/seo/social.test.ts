/* Social card metadata (StudyArena round-12, contestant D §2).

   D's §2 is about technical setup that lets crawlers and previewers render a
   page correctly. Scanning the 436 prerendered routes found two ways this
   site's social metadata failed at that, and this suite is the guard for
   both:

   1. The default card declared 1600x900 for an image that is 1376x768. A
      preview cropped from wrong numbers is visibly wrong, and it was
      published on every route inheriting the default.
   2. Every route with its *own* image — 411 of them — declared no dimensions,
      and two guide routes emitted a relative `og:url` and image path, which
      OGP requires to be absolute.

   The fix is not a constant; it is deriving the numbers from the measured
   map, and these tests assert the derivation rather than the current values
   so that adding an asset cannot reintroduce a hand-typed guess. */
import { describe, expect, it } from "vitest";
import { defaultSocialImage, DEFAULT_SOCIAL_IMAGE, socialImage } from "./social";
import { IMAGE_INTRINSIC_SIZES, intrinsicSizeOf } from "@/lib/media/intrinsic-sizes";
import { SITE_URL } from "./urls";

describe("social image metadata", () => {
  it("derives dimensions from the measured map for every mapped asset", () => {
    for (const name of Object.keys(IMAGE_INTRINSIC_SIZES)) {
      const image = socialImage(name);
      expect(image.width, name).toBe(intrinsicSizeOf(name)!.width);
      expect(image.height, name).toBe(intrinsicSizeOf(name)!.height);
      expect(image.width, name).toBeGreaterThan(0);
      expect(image.height, name).toBeGreaterThan(0);
    }
  });

  it("always emits an absolute URL, including for the default", () => {
    expect(defaultSocialImage().url).toMatch(/^https?:\/\//);
    expect(defaultSocialImage().url).toBe(`${SITE_URL}/images/${DEFAULT_SOCIAL_IMAGE}.jpg`);
    for (const name of Object.keys(IMAGE_INTRINSIC_SIZES)) {
      expect(socialImage(name).url, name).toMatch(/^https?:\/\//);
    }
  });

  /* The specific defect, restated so it cannot come back. */
  it("does not report the hero at 1600x900", () => {
    expect(defaultSocialImage()).toEqual({ url: `${SITE_URL}/images/hero-ahmedabad.jpg`, width: 1376, height: 768 });
    expect(defaultSocialImage().width).not.toBe(1600);
  });

  /* Guessing is how the wrong numbers got in. An unmapped asset yields a URL
     with no dimensions: a card that is fetched before it is laid out beats
     one laid out from an invented size. */
  it("omits dimensions rather than guessing for an unmapped asset", () => {
    expect(socialImage("not-an-asset")).toEqual({ url: `${SITE_URL}/images/not-an-asset.jpg` });
    expect(socialImage("not-an-asset").width).toBeUndefined();
  });

  it("keeps portrait assets portrait", () => {
    for (const [name, size] of Object.entries(IMAGE_INTRINSIC_SIZES)) {
      if (size.height > size.width) {
        expect(socialImage(name).height!).toBeGreaterThan(socialImage(name).width!);
      }
    }
  });
});
