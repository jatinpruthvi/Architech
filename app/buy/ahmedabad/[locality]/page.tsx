import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CityPage from "@/pages/CityPage";
import { getLocalityBySlug, getLocalityStaticParams } from "@/lib/repositories";
import { assetUrl, cityUrl, homeUrl, localityUrl } from "@/lib/seo/urls";
import { localityTrustSummary } from "@/lib/trust/locality";
import { localityIntel } from "@/lib/realestate/locality-intel";
import { LocalityTrust } from "@/components/architech/LocalityTrust";

export function generateStaticParams() {
  return getLocalityStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ locality: string }> }): Promise<Metadata> {
  const { locality: slug } = await params;
  const locality = getLocalityBySlug(slug);
  if (!locality) return { title: "Not found" };
  return {
    title: `${locality.name}, Ahmedabad — homes & locality context`,
    description: `Homes in ${locality.name} (${locality.hindi}), Ahmedabad: ${locality.note.toLowerCase()}. RERA-checked inventory, verified coordinates (${locality.coords}), and real distances.`,
    alternates: { canonical: localityUrl("ahmedabad", locality.slug) },
    openGraph: { title: `${locality.name}, Ahmedabad`, url: localityUrl("ahmedabad", locality.slug), images: [{ url: assetUrl("/images/locality-street.jpg") }] },
  };
}

export default async function Page({ params }: { params: Promise<{ locality: string }> }) {
  const { locality: slug } = await params;
  const locality = getLocalityBySlug(slug);
  if (!locality) notFound();

  const [lat, lon] = locality.marker.split(",");
  const trust = localityTrustSummary(slug);
  const intel = localityIntel(slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Place",
        name: `${locality.name}, Ahmedabad`,
        alternateName: locality.hindi,
        dateModified: intel.asOfDate,
        geo: { "@type": "GeoCoordinates", latitude: Number(lat), longitude: Number(lon) },
        containedInPlace: { "@type": "City", name: "Ahmedabad" },
        additionalProperty: [
          { "@type": "PropertyValue", name: "trustScore", value: trust.avgScore, unitText: "out of 100" },
          { "@type": "PropertyValue", name: "trustGrade", value: trust.grade },
          { "@type": "PropertyValue", name: "reraCoveragePct", value: trust.reraCoveragePct },
          { "@type": "PropertyValue", name: "sourceReviewedCount", value: trust.sourceReviewed },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl() },
          { "@type": "ListItem", position: 2, name: "Buy in Ahmedabad", item: cityUrl("ahmedabad") },
          { "@type": "ListItem", position: 3, name: locality.name, item: localityUrl("ahmedabad", locality.slug) },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CityPage localitySlug={locality.slug} />
      <LocalityTrust summary={trust} />
    </>
  );
}
