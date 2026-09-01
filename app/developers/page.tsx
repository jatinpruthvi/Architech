import type { Metadata } from "next";
import DeveloperIndexPage from "@/pages/DeveloperIndexPage";
import { getListings } from "@/lib/repositories/listings";
import { homeUrl, SITE_URL } from "@/lib/seo/urls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Builders and projects across India — Architech",
  description: "Browse Architech’s evidence-led developer and project index, with locality context, freshness signals, and source trails.",
  alternates: { canonical: `${SITE_URL}/developers/` },
  openGraph: { title: "Builders and projects across India — Architech", url: `${SITE_URL}/developers/`, type: "website" },
};

export default function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Builders and projects across India", description: "Evidence-led developer and project index for the cities Architech covers.", url: `${SITE_URL}/developers/`, isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><DeveloperIndexPage listingCount={getListings().length} /></>;
}
