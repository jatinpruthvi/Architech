import type { Metadata } from "next";
import { HtmlSitemapPage } from "@/pages/PublicParity";
import { canonicalUrl, homeUrl } from "@/lib/seo/urls";

export const metadata: Metadata = {
  title: "Sitemap — Architech India property discovery",
  description: "Crawlable HTML sitemap for Architech: discover homes across Indian cities, localities, developers, investment context, and methodology.",
  alternates: { canonical: canonicalUrl("/sitemap.html/") },
  openGraph: { title: "Sitemap — Architech India property discovery", url: canonicalUrl("/sitemap.html/"), type: "website" },
};

export default function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "WebPage", name: "Architech HTML Sitemap", url: canonicalUrl("/sitemap.html/"), isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><HtmlSitemapPage /></>;
}
