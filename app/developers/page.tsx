import type { Metadata } from "next";
import DeveloperIndexPage from "@/pages/DeveloperIndexPage";
import { homeUrl, SITE_URL } from "@/lib/seo/urls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ahmedabad builders and projects — Architech",
  description: "Browse Architech’s evidence-led Ahmedabad developer and project index, with locality context, freshness signals, and source trails.",
  alternates: { canonical: `${SITE_URL}/developers/` },
  openGraph: { title: "Ahmedabad builders and projects — Architech", url: `${SITE_URL}/developers/`, type: "website" },
};

export default function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Ahmedabad builders and projects", description: "Evidence-led developer and project index for Ahmedabad.", url: `${SITE_URL}/developers/`, isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><DeveloperIndexPage /></>;
}
