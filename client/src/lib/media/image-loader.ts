/* Cloudflare Image Transformations URL construction for R2-served media
   (docs/media/media-storage-decision.md, phase 3).
   https://developers.cloudflare.com/images/transform-images/
   URL scheme: <origin>/img/<width>-auto/<object-key> → the edge resizes and
   negotiates WebP/AVIF for the request; the R2 original is never served.
   First 5,000 unique transformations/month are free.
   This module is pure (no env, no fetch) so the next/image loader, the unit
   tests, and any future signed-URL variant share one implementation. */

/** `<origin>/img/<width>-auto/<object-key>` for an object under `baseUrl`.
    Returns null when the URL is not under the R2 public base (local assets,
    third-party images) — the caller must then serve the URL unchanged. */
export function r2TransformUrl(src: string, width: number, baseUrl: string): string | null {
  const base = baseUrl.replace(/\/+$/, "");
  if (!base) return null;
  /* Only absolute URLs strictly under the R2 public base are transformed;
     relative paths (/images/…), foreign origins and sibling domains that
     merely start with the base (base.evil.test) pass through untouched. */
  const afterBase = src.startsWith(base) ? src.slice(base.length) : null;
  if (afterBase === null || (afterBase !== "" && !afterBase.startsWith("/"))) return null;
  const objectPath = afterBase.replace(/^\/+/, "");
  if (!objectPath) return null;
  const safeWidth = Number.isFinite(width) && width >= 16 ? Math.min(Math.floor(width), 4096) : 1024;
  return `${base}/img/${safeWidth}-auto/${objectPath}`;
}

/** next/image custom loader: R2 URLs become transformation URLs, everything
    else is returned verbatim so local/fixture imagery keeps working. */
export function r2ImageLoader(src: string, width: number, baseUrl: string): string {
  return r2TransformUrl(src, width, baseUrl) ?? src;
}

/* The derivative plan in lib/media/upload.ts predates R2 and still names the
   legacy in-app paths (/media/derived/..., /media/thumbs/...). In r2 mode the
   resized variants are served on demand by Cloudflare Image Transformations,
   so the plan must point at real URLs or the record lies about what exists.
   Original → the stored object; resized kinds → /img/<width>-auto/<key>;
   `hls` has no equivalent in the images-only phase and stays as planned
   (guardrail: keep the video plan intact). */
export type PlannedDerivative = {
  kind: string;
  url: string;
  width?: number;
  [key: string]: unknown;
};

export function mapDerivativesToR2(
  derivatives: ReadonlyArray<PlannedDerivative>,
  publicUrl: string,
  objectKey: string,
): PlannedDerivative[] {
  const base = publicUrl.slice(0, publicUrl.length - objectKey.length);
  if (!publicUrl.endsWith(objectKey) || !base.endsWith("/")) return [...derivatives];
  return derivatives.map((derivative) => {
    if (derivative.kind === "original") return { ...derivative, url: publicUrl };
    if (derivative.kind === "hls") return derivative;
    const width = derivative.kind === "webp_800" ? 800 : derivative.kind === "thumbnail" ? 320 : derivative.width ?? 1600;
    const transformed = r2TransformUrl(publicUrl, width, base);
    return transformed ? { ...derivative, url: transformed } : derivative;
  });
}
