/* Open Graph image metadata.

   Two defects in how social cards were declared, both found by scanning the
   436 prerendered routes rather than by reading the code:

   1. The root layout hand-typed `1600x900` for hero-ahmedabad.jpg, which is
      1376x768 — a 16% overstatement of width published on every route that
      inherits the default. It survived because the measured dimensions lived
      inside the image primitive, which uses hooks and so cannot be imported
      by a server component.

   2. Every route that declared its *own* image — 411 of them — declared no
      dimensions at all, and two of the three guide routes declared a
      relative `og:url`. Three copies of the same Open Graph block, drifting.

   Both have the same fix: derive the numbers from the measured map instead
   of writing them, and let every page ask one function for the whole object.
   The map is read at build time from a hooks-free module, so a server
   component can use it.

   Dimensions remain optional in the protocol — crawlers that need them will
   fetch the image — but supplying them lets a preview card be laid out
   before the fetch, and wrong ones lay it out incorrectly. */
import { intrinsicSizeOf } from "@/lib/media/intrinsic-sizes";
import { assetUrl } from "./urls";

/** The card shown for routes that have no image of their own. */
export const DEFAULT_SOCIAL_IMAGE = "hero-ahmedabad";

export type SocialImage = { url: string; width?: number; height?: number };

/** An Open Graph image with its true dimensions, or just a URL if the asset
    is not in the measured map.

    Never guess dimensions. A card sized from wrong numbers is cropped; a card
    with no dimensions is merely fetched before it is laid out. */
export function socialImage(name: string): SocialImage {
  const url = assetUrl(`/images/${name}.jpg`);
  const size = intrinsicSizeOf(name);
  return size ? { url, width: size.width, height: size.height } : { url };
}

/** The site default: the hero, at its real size. */
export function defaultSocialImage(): SocialImage {
  return socialImage(DEFAULT_SOCIAL_IMAGE);
}
