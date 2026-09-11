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

/* The map itself lives in `lib/media/intrinsic-sizes.ts`, hooks-free, because
   a server component — the root layout declaring OpenGraph image dimensions —
   needs the same numbers and cannot import a module that uses hooks. */
import {
  DEFAULT_INTRINSIC_ASPECT as DEFAULT_ASPECT,
  DEFAULT_INTRINSIC_WIDTH as DEFAULT_WIDTH,
  IMAGE_INTRINSIC_SIZES,
  intrinsicSizeOf,
} from "@/lib/media/intrinsic-sizes";

/* `pic.test.ts` asserts this map against the real files. Both names refer to
   the same object so there is one source of truth, not two that can drift. */
export const PIC_INTRINSIC_SIZES = IMAGE_INTRINSIC_SIZES;

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
  const intrinsic = intrinsicSizeOf(name) ?? { width: DEFAULT_WIDTH, height: Math.round(DEFAULT_WIDTH / aspect) };
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
