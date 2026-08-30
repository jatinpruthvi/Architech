/* Measured intrinsic dimensions of the image derivatives in /public/images.

   This exists because the numbers were needed somewhere `Pic.tsx` could not be
   imported from. `Pic` uses React hooks, so a server component — the root
   layout, which declares the OpenGraph image dimensions — cannot import it.
   The map therefore lives here, hooks-free, and `Pic` consumes it.

   These must be the real numbers. A declared width/height that disagrees with
   the file makes a browser reserve the wrong amount of space and the page
   jumps when the photo lands (CLS), and makes a social platform crop a
   preview against the wrong shape. `intrinsic-sizes.test.ts` reads the actual
   files so the map cannot drift from reality. */
export type IntrinsicSize = { width: number; height: number };

export const IMAGE_INTRINSIC_SIZES: Record<string, IntrinsicSize> = {
  "hero-ahmedabad": { width: 1376, height: 768 },
  "locality-street": { width: 1264, height: 848 },
  "prop-courtyard": { width: 1200, height: 896 },
  "prop-light": { width: 1200, height: 896 },
  "prop-thaltej": { width: 1200, height: 896 },
  "brick-arch": { width: 896, height: 1200 },
  stepwell: { width: 896, height: 1200 },
};

/** Fallback for an asset not yet added to the map. Keep it as a last resort:
    an unmapped image should be measured and added, not guessed. */
export const DEFAULT_INTRINSIC_WIDTH = 1200;
export const DEFAULT_INTRINSIC_ASPECT = 1.5;

/** The measured size of an asset, or undefined when it is not in the map.

    Undefined rather than a fallback value: callers that must have a number can
    supply the fallback explicitly, and callers that can omit the attribute
    should. Guessing silently is how the original bug survived. */
export function intrinsicSizeOf(name: string): IntrinsicSize | undefined {
  return IMAGE_INTRINSIC_SIZES[name];
}
