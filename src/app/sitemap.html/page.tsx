import type { Metadata } from "next";
import { HtmlSitemapPage } from "@/screens/PublicParity";
import { homeUrl, htmlSitemapUrl } from "@/lib/seo/urls";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

export const metadata: Metadata = {
  title: "Sitemap — India property discovery",
  description: "Crawlable HTML sitemap for Architech: discover homes across Indian cities, localities, developers, investment context, and methodology.",
  alternates: { canonical: htmlSitemapUrl() },
  openGraph: { title: "Sitemap — India property discovery", url: htmlSitemapUrl(), type: "website" },
};

export default function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "WebPage", name: "Architech HTML Sitemap", url: htmlSitemapUrl(), isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} /><HtmlSitemapPage /></>;
}
