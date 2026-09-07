import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CityPage from "@/pages/CityPage";
import { getLiveCityBySlug, getLocalities, getLocalityBySlug, getLocalityStaticParams } from "@/lib/repositories";
import { getListingsByLocalityForServer, getListingsForServer } from "@/lib/repositories/server/prisma";
import { isIndexable } from "@/lib/seo/lifecycle";
import { cityUrl, homeUrl, listingUrl, localityUrl } from "@/lib/seo/urls";
import { socialImage } from "@/lib/seo/social";
import { localityTrustSummary } from "@/lib/trust/locality";
import { localityIntel } from "@/lib/realestate/locality-intel";
import { localitySerpDescription, localitySerpTitle } from "@/lib/seo/serp";
import { LocalityTrust } from "@/components/architech/LocalityTrust";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";
import { cityNode, localityId } from "@/lib/seo/entity-graph";
import { buildFaqPage, localityFaqEntries } from "@/lib/seo/faq";
import { FaqSection } from "@/components/architech/FaqSection";
import { compactInr } from "@/lib/realestate/format-inr";

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
  /* Server-mode reads: with ARCHITECH_DATA_SOURCE=prisma these come from the
     database, so a locality page can never name a listing dossier that 404s.
     In fixture mode the adapter returns the same fixtures the static path did. */
  const localHomes = await getListingsByLocalityForServer(locality.slug, city.slug);
  const cityHomes = await getListingsForServer({ citySlug: city.slug });
  const listings = localHomes.filter((listing) => isIndexable(listing.lifecycle ?? "ACTIVE"));

  /* FAQ built from this locality's own facts, and rendered below from the same
     array. Each generator drops out when its fact is missing, so a thin
     locality yields too few entries and `buildFaqPage` returns null instead of
     stamping a templated FAQ across every page. */
  const faqEntries = localityFaqEntries({
    localityName: locality.name,
    cityName: city.name,
    stateName: city.state,
    reraAuthority: city.reraAuthority,
    pincodes: locality.pincodes,
    landmarks: (locality.landmarks ?? []).map(([name]) => name),
    saleCount: listings.filter((listing) => listing.transaction !== "rent").length,
    rentCount: listings.filter((listing) => listing.transaction === "rent").length,
    /* `medianPriceInr` is already null unless the buy sample is large enough to
       read as a locality summary rather than one or two asking prices, so this
       question disappears exactly when it would have been misleading. */
    medianPriceLabel: intel.medianPriceInr === null ? null : compactInr(intel.medianPriceInr),
    intent: "buy",
    asOfDate: intel.asOfDate,
  });
  const faq = buildFaqPage(faqEntries, localityUrl(city.slug, locality.slug));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Place",
        /* One id for this locality across BOTH intents: the buy and rent URLs
           are two views of one real place, and saying so is what stops them
           competing as separate entities. */
        "@id": localityId(city.slug, locality.slug),
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
        /* A reference, not a re-description. The city is defined on its own
           hub; restating its properties here would create a competing copy. */
        containedInPlace: cityNode({ slug: city.slug, name: city.name, state: city.state, stateSlug: city.stateSlug }),
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
      ...(faq ? [faq] : []),
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
      {faq && (
        <FaqSection
          entries={faqEntries}
          heading={`Buying in ${locality.name}: common questions`}
        />
      )}
    </>
  );
}
