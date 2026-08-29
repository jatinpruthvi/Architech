/* ARCHITECH — image primitive: responsive assets, explicit eager loading, safe
   custom art direction, and a paint that does not punch you.
 *
 * Two things this file used to get wrong, both invisible in devtools:
 *
 * 1. `width`/`height` were only set on the `src` escape hatch, so every
 *    `name=` usage — the whole card grid — had no intrinsic size. The container
 *    collapses, the image lands, the page jumps. The WIDTHS map already existed
 *    for srcset generation; the aspect ratio it implies is the same information
 *    the layout needed, so there is no new truth here, only an unused one.
 * 2. Photos snapped from the flat `bg-sand` placeholder to full opacity in one
 *    frame. Now they fade in over 260ms once decoded — long enough to read as
 *    "the photo arrived", short enough never to feel like a loader.
 */
import { useCallback, useState } from "react";

/* Intrinsic dimensions of the full-size derivative in /public/images.

   These are the source of truth for the width/height attributes, and they must
   be the real numbers: a declared ratio that disagrees with the actual file
   makes the browser reserve the wrong amount of space, so the page jumps when
   the photo lands. That is a direct CLS cost on the LCP element.

   `DEFAULT_ASPECT` previously stood in for all of them, on the comment's claim
   that "1.5 is what every derivative in /public/images is cropped to". Measured
   against the files, that held for one asset out of seven: the two portrait
   assets were being declared landscape (896x597 against an actual 896x1200, a
   603px error), the hero was 149px out, and the three property photos 96px out.
   The ratio is now per-asset and `pic.test.ts` asserts this map against the real
   files, so it cannot silently go stale again. */
export const PIC_INTRINSIC_SIZES: Record<string, { width: number; height: number }> = {
  "hero-ahmedabad": { width: 1376, height: 768 },
  "locality-street": { width: 1264, height: 848 },
  "prop-courtyard": { width: 1200, height: 896 },
  "prop-light": { width: 1200, height: 896 },
  "prop-thaltej": { width: 1200, height: 896 },
  "brick-arch": { width: 896, height: 1200 },
  stepwell: { width: 896, height: 1200 },
};

/* Fallback for an asset not yet added to the map above. Keep it as a last
   resort: an unmapped image should be measured and added, not guessed. */
const DEFAULT_WIDTH = 1200;
const DEFAULT_ASPECT = 1.5;

type PicProps = {
  name: string;
  alt: string;
  className?: string;
  sizes?: string;
  eager?: boolean;
  src?: string;
  mobileSrc?: string;
  aspect?: number;
};

export default function Pic({ name, alt, className = "", sizes = "(max-width: 768px) 100vw, 50vw", eager = false, src, mobileSrc, aspect = DEFAULT_ASPECT }: PicProps) {
  const [loaded, setLoaded] = useState(false);
  /* An explicit `aspect` prop only governs an asset that is not in the map yet,
     so measuring and adding the asset remains the right fix. */
  const intrinsic = PIC_INTRINSIC_SIZES[name] ?? { width: DEFAULT_WIDTH, height: Math.round(DEFAULT_WIDTH / aspect) };
  const fullWidth = intrinsic.width;
  const srcSet = fullWidth > 800
    ? `/images/${name}-800.webp 800w, /images/${name}.webp ${fullWidth}w`
    : `/images/${name}.webp ${fullWidth}w`;
  const desktopSrc = src ?? `/images/${name}.jpg`;
  /* <picture> is `display: contents`, so the ref below is the <img> itself. */
  const markLoaded = useCallback(() => setLoaded(true), []);
  const attach = useCallback((img: HTMLImageElement | null) => {
    // A back-navigation or an already-warm cache can complete BEFORE React
    // attaches onLoad; without this the photo would stay at opacity 0 forever.
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <picture className="contents">
      {mobileSrc ? <source media="(max-width: 768px)" srcSet={mobileSrc} /> : null}
      {!src ? <source type="image/webp" srcSet={srcSet} sizes={sizes} /> : null}
      <img
        ref={attach}
        src={desktopSrc}
        alt={alt}
        className={`${className} pic-fade${loaded ? " pic-fade-in" : ""}`}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        width={src ? 1600 : intrinsic.width}
        height={src ? 900 : intrinsic.height}
        onLoad={markLoaded}
        onError={markLoaded}
      />
    </picture>
  );
}
