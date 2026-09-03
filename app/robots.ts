import type { MetadataRoute } from "next";
import { loginPath, savedPath, searchPath, sitemapIndexUrl } from "@/lib/seo/urls";
import { isPublicIndexingEnabled } from "@/lib/seo/runtime";

export default function robots(): MetadataRoute.Robots {
  const indexingEnabled = isPublicIndexingEnabled();
  return {
    rules: [{ userAgent: "*", allow: indexingEnabled ? "/" : [], disallow: indexingEnabled ? [savedPath(), searchPath(), loginPath()] : ["/"] }],
    sitemap: sitemapIndexUrl(),
  };
}
