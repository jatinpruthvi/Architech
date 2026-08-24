/* Responsive <picture>: WebP with accurate width descriptors, JPEG fallback, lazy by default. */
const WIDTHS: Record<string, number> = {
  "hero-ahmedabad": 1376,
  "locality-street": 1264,
  "prop-courtyard": 1200,
  "prop-light": 1200,
  "prop-thaltej": 1200,
  "brick-arch": 896,
  "stepwell": 896,
};

export default function Pic({ name, alt, className = "", sizes = "(max-width: 768px) 100vw, 50vw", eager = false }: { name: string; alt: string; className?: string; sizes?: string; eager?: boolean }) {
  const fullWidth = WIDTHS[name] ?? 1200;
  const srcSet = fullWidth > 800
    ? `/images/${name}-800.webp 800w, /images/${name}.webp ${fullWidth}w`
    : `/images/${name}.webp ${fullWidth}w`;
  return (
    <picture className="contents">
      <source type="image/webp" srcSet={srcSet} sizes={sizes} />
      <img
        src={`/images/${name}.jpg`}
        alt={alt}
        className={className}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
      />
    </picture>
  );
}
