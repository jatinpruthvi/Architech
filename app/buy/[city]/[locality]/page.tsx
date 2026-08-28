import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CityPage from "@/pages/CityPage";
import { getLiveCityBySlug, getLocalityBySlug, getLocalityStaticParams } from "@/lib/repositories";
import { assetUrl, cityUrl, homeUrl, localityUrl } from "@/lib/seo/urls";
import { localityTrustSummary } from "@/lib/trust/locality";
import { localityIntel } from "@/lib/realestate/locality-intel";
import { LocalityTrust } from "@/components/architech/LocalityTrust";

export function generateStaticParams() {
  return getLocalityStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ city: string; locality: string }> }): Promise<Metadata> {
  const { city: citySlug, locality: slug } = await params;
  const city = getLiveCityBySlug(citySlug);
  const locality = city ? getLocalityBySlug(slug, city.slug) : undefined;
  if (!city || !locality) return { title: "Not found" };
  return {
    title: `${locality.name}, ${city.name} — homes & locality context`,
    description: `Homes in ${locality.name} (${locality.hindi}), ${city.name}: ${locality.note.toLowerCase()}. ${city.reraAuthority}-checked inventory, verified coordinates (${locality.coords}), and real distances.`,
    alternates: { canonical: localityUrl(city.slug, locality.slug) },
    openGraph: { title: `${locality.name}, ${city.name}`, url: localityUrl(city.slug, locality.slug), images: [{ url: assetUrl("/images/locality-street.jpg") }] },
  };
}

export default async function Page({ params }: { params: Promise<{ city: string; locality: string }> }) {
  const { city: citySlug, locality: slug } = await params;
  const city = getLiveCityBySlug(citySlug);
  const locality = city ? getLocalityBySlug(slug, city.slug) : undefined;
  if (!city || !locality) notFound();

  const [lat, lon] = locality.marker.split(",");
  const trust = localityTrustSummary(slug);
  const intel = localityIntel(slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Place",
        name: `${locality.name}, ${city.name}`,
        alternateName: locality.hindi,
        dateModified: intel.asOfDate,
        geo: { "@type": "GeoCoordinates", latitude: Number(lat), longitude: Number(lon) },
        containedInPlace: { "@type": "City", name: city.name, containedInPlace: { "@type": "AdministrativeArea", name: city.state } },
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
          { "@type": "ListItem", position: 2, name: `Buy in ${city.name}`, item: cityUrl(city.slug) },
          { "@type": "ListItem", position: 3, name: locality.name, item: localityUrl(city.slug, locality.slug) },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CityPage localitySlug={locality.slug} citySlug={city.slug} />
      <LocalityTrust summary={trust} />
    </>
  );
}
