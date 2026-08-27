import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const frameAncestors = isProduction ? "'none'" : "'self' https://*.e2b.app";
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
  // Keep both allowlists so the Next.js dev client can hydrate through either
  // proxy family; without this, server-rendered controls remain inert in Chrome.
  allowedDevOrigins: [
    "*.e2b.app",
    "*.manus.computer",
    "3000-ic1kcjb43qdag8kqqfuag-1217bc80.sg1.manus.computer",
    "3000-i3hdv4omcwxuvbaopwpw2-bed17bd0.sg1.manus.computer",
    "3000-ixa0ycaohqn3uu7gchacy-2d2aebe2.sg1.manus.computer",
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
