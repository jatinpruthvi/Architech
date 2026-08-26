/* Amdavad Modern image primitive: responsive assets, explicit eager loading, and safe custom art direction. */
const WIDTHS: Record<string, number> = {
  "hero-ahmedabad": 1376,
  "locality-street": 1264,
  "prop-courtyard": 1200,
  "prop-light": 1200,
  "prop-thaltej": 1200,
  "brick-arch": 896,
  "stepwell": 896,
};

type PicProps = {
  name: string;
  alt: string;
  className?: string;
  sizes?: string;
  eager?: boolean;
  src?: string;
  mobileSrc?: string;
};

export default function Pic({ name, alt, className = "", sizes = "(max-width: 768px) 100vw, 50vw", eager = false, src, mobileSrc }: PicProps) {
  const fullWidth = WIDTHS[name] ?? 1200;
  const srcSet = fullWidth > 800
    ? `/images/${name}-800.webp 800w, /images/${name}.webp ${fullWidth}w`
    : `/images/${name}.webp ${fullWidth}w`;
  const desktopSrc = src ?? `/images/${name}.jpg`;
  return (
    <picture className="contents">
      {mobileSrc ? <source media="(max-width: 768px)" srcSet={mobileSrc} /> : null}
      {!src ? <source type="image/webp" srcSet={srcSet} sizes={sizes} /> : null}
      <img
        src={desktopSrc}
        alt={alt}
        className={className}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        width={src ? 1600 : undefined}
        height={src ? 900 : undefined}
      />
    </picture>
  );
}
