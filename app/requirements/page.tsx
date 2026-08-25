import type { Metadata } from "next";
import RequirementsPage from "@/pages/RequirementsPage";
import { homeUrl, SITE_URL } from "@/lib/seo/urls";

export const metadata: Metadata = {
  title: "Tell us what you need in Ahmedabad — Architech",
  description: "Share a clear Ahmedabad property brief for buying, renting, commercial space, co-living, plots, land, or bank-auction opportunities.",
  alternates: { canonical: `${SITE_URL}/requirements/` },
  openGraph: { title: "Tell us what you need in Ahmedabad — Architech", url: `${SITE_URL}/requirements/`, type: "website" },
};

export default function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "WebPage", name: "Tell us what you need in Ahmedabad", url: `${SITE_URL}/requirements/`, isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><RequirementsPage /></>;
}
