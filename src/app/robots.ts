import type { MetadataRoute } from "next";
import { loginPath, savedPath, searchPath, sitemapIndexUrl } from "@/lib/seo/urls";
import { isPublicIndexingEnabled } from "@/lib/seo/runtime";
import { buildAiCrawlerRules } from "@/lib/seo/ai-crawlers";

export default function robots(): MetadataRoute.Robots {
  const indexingEnabled = isPublicIndexingEnabled();
  /* Thin, private, or infinite-space surfaces. Hoisted to a const because the
     AI-crawler rules reuse the exact same list — an allowed search bot gets
     the same exclusions as everyone else, and deriving it twice is how the
     two rule sets drift apart. */
  const sharedDisallow = [savedPath(), searchPath(), loginPath()];
  return {
    rules: [
      { userAgent: "*", allow: indexingEnabled ? "/" : [], disallow: indexingEnabled ? sharedDisallow : ["/"] },
      /* Explicit per-bot AI-crawler policy. Without these the wildcard above
         silently grants training crawlers the whole corpus — see
         lib/seo/ai-crawlers.ts for why that is a LEG-003/LEG-008 problem
         while the inventory is unverified demo data. */
      ...buildAiCrawlerRules(indexingEnabled ? sharedDisallow : [], process.env),
    ],
    sitemap: sitemapIndexUrl(),
  };
}
