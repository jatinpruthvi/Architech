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

const WIDTHS: Record<string, number> = {
  "hero-ahmedabad": 1376,
  "locality-street": 1264,
  "prop-courtyard": 1200,
  "prop-light": 1200,
  "prop-thaltej": 1200,
  "brick-arch": 896,
  "stepwell": 896,
};

/* Only used to derive a height from the known width, and 1.5 is what every
   derivative in /public/images is cropped to. An explicit `aspect` prop beats
   it; if a future asset is square, pass aspect rather than editing this. */
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
  const fullWidth = WIDTHS[name] ?? 1200;
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
        width={src ? 1600 : fullWidth}
        height={src ? 900 : Math.round(fullWidth / aspect)}
        onLoad={markLoaded}
        onError={markLoaded}
      />
    </picture>
  );
}
