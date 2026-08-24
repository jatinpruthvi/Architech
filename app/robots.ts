import type { MetadataRoute } from "next";
import { savedPath, searchPath, sitemapUrl } from "@/lib/seo/urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [savedPath(), searchPath()] }],
    sitemap: sitemapUrl(),
  };
}
