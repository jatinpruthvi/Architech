import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
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
      "img-src 'self' data: blob: https://tile.openstreetmap.org",
      "connect-src 'self' https://*.ingest.sentry.io https://tile.openstreetmap.org",
      "frame-src 'self' https://www.openstreetmap.org",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Match the architecture's canonical URL grammar (/buy/{city}/{locality}/)
  trailingSlash: true,
  // Sandbox live-preview domains changed from *.e2b.app to *.manus.computer.
  // Wildcards only — exact sandbox hostnames rotate and listing them here
  // silently breaks the next preview.
  allowedDevOrigins: [
    "*.e2b.app",
    "*.manus.computer",
    "localhost",
    "127.0.0.1",
  ],
  // Plain <img>/<picture> pipeline (pre-generated WebP derivatives)
  images: {
    // Public assets currently use pre-generated WebP derivatives. Keep this
    // explicit until the R2 image loader is activated, then remove the flag
    // and enforce responsive derivative tests in the deployment pipeline.
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
