/* next/image custom loader (docs/media/media-storage-decision.md, phase 3).
   Referenced from next.config.ts as `images.loaderFile` only when
   ARCHITECH_MEDIA_STORAGE=r2, i.e. when R2 public base is configured.
   Next.js bundles this file for the browser, so it must stay dependency-free
   (no server-only imports, no node builtins) — `r2ImageLoader` in image-loader.ts
   is pure for exactly this reason.
   Reads the R2 public base from a NEXT_PUBLIC_* var so the browser can build
   transformation URLs without a round-trip. */
import { r2ImageLoader } from "./image-loader";

export default function loader({ src, width }: { src: string; width: number; quality?: number }): string {
  const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? "";
  return r2ImageLoader(src, width, baseUrl);
}
