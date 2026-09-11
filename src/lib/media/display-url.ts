/* Resolving stored media URLs to what the browser should fetch (media
   storage decision, phase 3 — delivery layer).
   The mapping (lib/repositories/mappers.ts) exposes absolute media URLs on
   Property when the data source carries them (R2 public URLs in r2 mode).
   Renderers call `mediaDisplayUrl(url, width)`:
     - R2 URL under the configured public base → Cloudflare Image
       Transformations URL at the requested width (edge resizes + negotiates
       WebP/AVIF; the original is never downloaded). Same URL scheme the
       next/image custom loader uses, so both paths agree.
     - any other absolute URL → served as-is (no origin rewrite).
     - relative/missing → undefined, so the caller falls back to the local
       fixture asset (lib/media/intrinsic-sizes + /images/* derivatives).
   Build-time constants only: NEXT_PUBLIC_R2_PUBLIC_BASE_URL is inlined for
   the client bundle, so this works in browser components without a round-trip.
   */
import { r2TransformUrl } from "./image-loader";

export function r2DisplayBase(env: Partial<Record<string, string | undefined>> = process.env): string {
  return (env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
}

export function mediaDisplayUrl(
  url: string | null | undefined,
  width: number,
  env: Partial<Record<string, string | undefined>> = process.env,
): string | undefined {
  if (!url || !/^https?:\/\//.test(url)) return undefined;
  const base = r2DisplayBase(env);
  if (base) {
    const transformed = r2TransformUrl(url, width, base);
    if (transformed) return transformed;
  }
  return url;
}
