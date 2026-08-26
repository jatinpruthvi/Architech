import type { MetadataRoute } from "next";
import { getIndexableSeoPages } from "@/lib/seo/pages";
import { isPublicIndexingEnabled } from "@/lib/seo/runtime";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isPublicIndexingEnabled()) return [];
  const now = new Date();
  return getIndexableSeoPages().map((page) => ({
    url: page.canonicalUrl,
    lastModified: now,
    changeFrequency: page.sitemap.changeFrequency,
    priority: page.sitemap.priority,
  }));
}
