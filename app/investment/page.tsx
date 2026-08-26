import type { Metadata } from "next";
import InvestmentPage from "@/pages/InvestmentPage";
import { homeUrl, SITE_URL } from "@/lib/seo/urls";

export const metadata: Metadata = {
  title: "Ahmedabad investment lens — Architech",
  description: "Read Ahmedabad property signals through locality movement, supply, documentation, and everyday context. General information, not personalized financial advice.",
  alternates: { canonical: `${SITE_URL}/investment/` },
  openGraph: { title: "Ahmedabad investment lens — Architech", url: `${SITE_URL}/investment/`, type: "article" },
};

export default function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: "Ahmedabad investment lens", description: "General editorial context for reading Ahmedabad property signals.", url: `${SITE_URL}/investment/`, isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><InvestmentPage /></>;
}
