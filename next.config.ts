import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { NextConfig } from "next";

/* Serve the production MapLibre build from /vendor so Turbopack does not
   inline ~1 MiB of map code into `.next/static/chunks` (the total-JS budget
   counts those chunks). Copied at config-eval so `next dev` and `next build`
   both see the files. */
const maplibreRoot = dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json"));
const maplibreVendor = join(process.cwd(), "public/vendor");
mkdirSync(maplibreVendor, { recursive: true });
for (const file of ["maplibre-gl.mjs", "maplibre-gl-shared.mjs", "maplibre-gl-worker.mjs", "maplibre-gl.css"]) {
  copyFileSync(join(maplibreRoot, "dist", file), join(maplibreVendor, file));
}

const isProduction = process.env.NODE_ENV === "production";

/* Image delivery (docs/media/media-storage-decision.md): in R2 mode listing
   images are served from Cloudflare's edge via Image Transformations, so
   next/image gets a custom loader that rewrites R2 URLs to
   <origin>/img/<width>-auto/<key> (WebP/AVIF negotiated at the edge; the
   8 MB original is never downloaded). Memory/dev mode keeps the plain
   <picture>/<img> pipeline over pre-generated WebP derivatives. The public
   base is resolved from the browser-visible var first (the loader runs in the
   client bundle), falling back to the server-only var for build-time CSP. */
const r2ImageDelivery = process.env.ARCHITECH_MEDIA_STORAGE === "r2";
const r2PublicBase = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
let r2PublicOrigin: string | null = null;
if (r2PublicBase) {
  try {
    r2PublicOrigin = new URL(r2PublicBase).origin;
  } catch {
    r2PublicOrigin = null;
  }
}
/* Preview proxies: both the current (manus.computer) and legacy (e2b.app)
   wildcard families so dev previews can embed the app in either environment.
   Exact hostnames are never listed — they rotate per sandbox. */
const frameAncestors = isProduction ? "'none'" : "'self' https://*.e2b.app https://*.manus.computer";
const scriptSource = isProduction ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: isProduction ? "max-age=63072000; includeSubDomains; preload" : "max-age=0" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      `frame-ancestors ${frameAncestors}`,
      `script-src ${scriptSource}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      `img-src 'self' data: blob: https://tile.openstreetmap.org${r2PublicOrigin ? ` ${r2PublicOrigin}` : ""}`,
      `connect-src 'self' https://*.ingest.sentry.io https://tile.openstreetmap.org${r2PublicOrigin ? ` ${r2PublicOrigin}` : ""}`,
      "frame-src 'self' https://www.openstreetmap.org",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Match the architecture's canonical URL grammar (/buy/{city}/{locality}/)
  trailingSlash: true,
  // Named imports from these packages otherwise drag the whole icon/motion
  // barrel into every client route and blow the first-load JS budget.
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
  // Sandbox live-preview domains changed from *.e2b.app to *.manus.computer.
  // Wildcards only — exact sandbox hostnames rotate and listing them here
  // silently breaks the next preview.
  allowedDevOrigins: [
    "*.e2b.app",
    "*.manus.computer",
    "localhost",
    "127.0.0.1",
  ],
  // Image pipeline. R2 mode: custom loader rewrites R2 URLs to Cloudflare
  // Image Transformations URLs (edge-side WebP/AVIF + resize), so Next's
  // optimizer is bypassed. Memory/dev mode: plain <img>/<picture> over
  // pre-generated WebP derivatives (unoptimized, as before).
  images: r2ImageDelivery
    ? {
        loader: "custom",
        loaderFile: "./client/src/lib/media/next-image-loader.ts",
      }
    : {
        unoptimized: true,
        formats: ["image/avif", "image/webp"],
      },
  async headers() {
    const rules = [{ source: "/:path*", headers: securityHeaders }];
    if (!isProduction) {
      // Turbopack dev chunk URLs are stable across edits; if a proxy or the
      // browser cache retains an old chunk, a "reload" silently re-runs stale
      // JS (zombie hydration errors, "(stale)" dev badge). Force revalidation
      // in dev so every load executes the current code. Production chunks are
      // content-hashed and stay cacheable.
      rules.push({
        source: "/_next/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      });
    }
    return rules;
  },
};

export default nextConfig;
