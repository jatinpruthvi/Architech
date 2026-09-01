import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CityPage from "@/pages/CityPage";
import { getListingsByCity, getListingsByLocality, getLiveCityBySlug, getLocalities, getLocalityBySlug, getLocalityStaticParams } from "@/lib/repositories";
import { isIndexable } from "@/lib/seo/lifecycle";
import { cityUrl, homeUrl, listingUrl, localityUrl } from "@/lib/seo/urls";
import { socialImage } from "@/lib/seo/social";
import { localityTrustSummary } from "@/lib/trust/locality";
import { localityIntel } from "@/lib/realestate/locality-intel";
import { localitySerpDescription, localitySerpTitle } from "@/lib/seo/serp";
import { LocalityTrust } from "@/components/architech/LocalityTrust";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

export function generateStaticParams() {
  return getLocalityStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ city: string; locality: string }> }): Promise<Metadata> {
  const { city: citySlug, locality: slug } = await params;
  const city = getLiveCityBySlug(citySlug);
  const locality = city ? getLocalityBySlug(slug, city.slug) : undefined;
  if (!city || !locality) return { title: "Not found" };
  const title = localitySerpTitle({
    name: locality.name,
    note: locality.note,
    pincodes: locality.pincodes,
    cityName: city.name,
    reraAuthority: city.reraAuthority,
    intel: localityIntel(slug, city.slug),
  });
  return {
    title,
    description: localitySerpDescription({
      name: locality.name,
      note: locality.note,
      pincodes: locality.pincodes,
      cityName: city.name,
      reraAuthority: city.reraAuthority,
      intel: localityIntel(slug, city.slug),
    }),
    alternates: { canonical: localityUrl(city.slug, locality.slug) },
    openGraph: { title, url: localityUrl(city.slug, locality.slug), images: [socialImage("locality-street")] },
  };
}

export default async function Page({ params }: { params: Promise<{ city: string; locality: string }> }) {
  const { city: citySlug, locality: slug } = await params;
  const city = getLiveCityBySlug(citySlug);
  const locality = city ? getLocalityBySlug(slug, city.slug) : undefined;
  if (!city || !locality) notFound();

  const [lat, lon] = locality.marker.split(",");
  const trust = localityTrustSummary(slug, city.slug);
  const intel = localityIntel(slug, city.slug);
  // Only publicly indexable (ACTIVE) listings belong in the page's ItemList:
  // schema must describe what the page actually publishes.
  const localHomes = getListingsByLocality(locality.slug, city.slug);
  const cityHomes = getListingsByCity(city.slug);
  const listings = localHomes.filter((listing) => isIndexable(listing.lifecycle ?? "ACTIVE"));
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Place",
        name: `${locality.name}, ${city.name}`,
        alternateName: locality.hindi,
        dateModified: intel.asOfDate,
        geo: { "@type": "GeoCoordinates", latitude: Number(lat), longitude: Number(lon) },
        // A locality can span several PINs; PostalAddress carries a single
        // postalCode, so the principal one is emitted here and the full list is
        // stated on the page and in additionalProperty below.
        address: {
          "@type": "PostalAddress",
          addressLocality: locality.name,
          addressRegion: city.state,
          ...(locality.pincodes.length ? { postalCode: locality.pincodes[0] } : {}),
          addressCountry: "IN",
        },
        containedInPlace: { "@type": "City", name: city.name, containedInPlace: { "@type": "AdministrativeArea", name: city.state } },
        additionalProperty: [
          { "@type": "PropertyValue", name: "trustScore", value: trust.avgScore, unitText: "out of 100" },
          { "@type": "PropertyValue", name: "trustGrade", value: trust.grade },
          { "@type": "PropertyValue", name: "reraCoveragePct", value: trust.reraCoveragePct },
          { "@type": "PropertyValue", name: "sourceReviewedCount", value: trust.sourceReviewed },
          ...(locality.pincodes.length
            ? [{ "@type": "PropertyValue", name: "pincodes", value: locality.pincodes.join(", ") }]
            : []),
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
      // The page visibly renders a list of homes, so describe it as one. Only
      // ACTIVE listings are asserted — a `noindex` or sold listing is not part
      // of the list this page publishes.
      ...(listings.length
        ? [
            {
              "@type": "ItemList",
              name: `Homes in ${locality.name}, ${city.name}`,
              numberOfItems: listings.length,
              itemListElement: listings.map((listing, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: listing.title,
                url: listingUrl(listing.id),
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <CityPage
        locality={locality}
        city={city}
        showcase={(localHomes.length ? [...localHomes, ...cityHomes.filter((p) => p.localitySlug !== locality.slug)] : cityHomes).slice(0, 4)}
        nearby={getLocalities(city.slug).filter((item) => item.slug !== locality.slug).slice(0, 5)}
        intel={intel}
        trust={trust}
        newProjects={localHomes.filter((p) => p.availability === "NEW_LAUNCH" || p.availability === "UNDER_CONSTRUCTION")}
      />
      <LocalityTrust summary={trust} />
    </>
  );
}
