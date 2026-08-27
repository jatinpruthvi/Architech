import type { MetadataRoute } from "next";
import { getIndexableSeoPages } from "@/lib/seo/pages";
import { isPublicIndexingEnabled } from "@/lib/seo/runtime";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isPublicIndexingEnabled()) return [];
  return getIndexableSeoPages().map((page) => ({
    url: page.canonicalUrl,
    changeFrequency: page.sitemap.changeFrequency,
    priority: page.sitemap.priority,
  }));
}
