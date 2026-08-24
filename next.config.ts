import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Match the architecture's canonical URL grammar (/buy/{city}/{locality}/)
  trailingSlash: true,
  // Sandbox live-preview is proxied via *.e2b.app
  allowedDevOrigins: ["*.e2b.app"],
  // Plain <img>/<picture> pipeline (pre-generated WebP derivatives)
  images: { unoptimized: true },
};

export default nextConfig;
