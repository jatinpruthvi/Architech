import type { Metadata } from "next";
import DeveloperIndexPage from "@/pages/DeveloperIndexPage";
import { getListingsForServer } from "@/lib/repositories/server/prisma";
import { homeUrl, SITE_URL } from "@/lib/seo/urls";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Builders and projects across India — Architech",
  description: "Browse Architech’s evidence-led developer and project index, with locality context, freshness signals, and source trails.",
  alternates: { canonical: `${SITE_URL}/developers/` },
  openGraph: { title: "Builders and projects across India — Architech", url: `${SITE_URL}/developers/`, type: "website" },
};

export default async function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Builders and projects across India", description: "Evidence-led developer and project index for the cities Architech covers.", url: `${SITE_URL}/developers/`, isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() } };
  const listings = await getListingsForServer({});
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} /><DeveloperIndexPage listingCount={listings.length} /></>;
}
