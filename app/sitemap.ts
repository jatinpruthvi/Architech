import type { MetadataRoute } from "next";
import { localities } from "@/lib/localities";
import { properties } from "@/lib/properties";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://architech-demo.example.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/buy/ahmedabad/`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...localities.map((l) => ({ url: `${SITE_URL}/buy/ahmedabad/${l.slug}/`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 })),
    ...properties.map((p) => ({ url: `${SITE_URL}/listing/${p.id}/`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
    { url: `${SITE_URL}/guide/`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];
}
