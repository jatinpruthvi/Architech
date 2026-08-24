import type { MetadataRoute } from "next";
import { getIndexableSeoPages } from "@/lib/seo/pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return getIndexableSeoPages().map((page) => ({
    url: page.canonicalUrl,
    lastModified: now,
    changeFrequency: page.sitemap.changeFrequency,
    priority: page.sitemap.priority,
  }));
}
