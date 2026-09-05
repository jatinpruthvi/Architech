import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import ListingPage from "@/pages/ListingPage";
import { getCityBySlug, getLocalityBySlug, getRelatedListings } from "@/lib/repositories";
import { comparableListings } from "@/lib/listing/comparables";
import { getListingByIdForServer, getListingStaticParamsForServer } from "@/lib/repositories/server/prisma";
import { assetUrl, cityUrl, homeUrl, listingUrl, localityUrl } from "@/lib/seo/urls";
import { socialImage } from "@/lib/seo/social";
import { httpDecisionForListing } from "@/lib/seo/lifecycle";
import { badgesToTrustInput, computeTrustScore } from "@/lib/trust/score";
import { buildAgentJsonLd, buildAgentProfile } from "@/lib/agent/profile";
import { demoBrokerSession } from "@/lib/auth/roles";
import { residenceSchemaType } from "@/lib/listing-vocabulary";
import { listingSerpDescription, listingSerpTitle } from "@/lib/seo/serp";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

/* Cost-reduction-audit P0.5: `generateMetadata` and the page both resolved
   the same listing, so every request ran the DB lookup twice. `cache` is
   per-request, so both now share one result. */
const getCachedListing = cache((id?: string) => getListingByIdForServer(id));

/* ISR: listings change infrequently (price/availability edits). Pre-render
   the known ids at build/deploy, then revalidate on a short interval so new
   or updated listings become cached pages instead of paying per-request SSR.
   Unknown ids still render on demand (dynamicParams defaults to true). */
export const revalidate = 600;

export async function generateStaticParams() {
  return getListingStaticParamsForServer();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const property = await getCachedListing(id);
  if (!property) return { title: "Not found" };
  const metadataDecision = httpDecisionForListing(property.lifecycle, property.canonicalToListingId, { continuingValue: property.continuingSeoValue });
  // Title and description are composed against a SERP length budget: see
  // `lib/seo/serp.ts`. The page-level title must leave room for the brand
  // suffix the root layout appends, or Google truncates the number off the end.
  const title = listingSerpTitle(property);
  return {
    title,
    description: listingSerpDescription(property),
    alternates: { canonical: listingUrl(property.id) },
    robots: { index: metadataDecision.indexable, follow: true },
    openGraph: { title, url: listingUrl(property.id), images: [socialImage(property.image)] },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = await getCachedListing(id);
  if (!property) notFound();

  // Enforce listing-indexability per the SEO-004 lifecycle contract. A non-ACTIVE
  // listing resolves to notFound (404) / a permanent redirect here; a DUPLICATE
  // listing redirects to its canonical target. The canonical column is read
  // here — the moderation path writes it, so this is what makes the 301 real.
  const decision = httpDecisionForListing(property.lifecycle, property.canonicalToListingId, { continuingValue: property.continuingSeoValue });
  if (decision.status === 301 && "redirectTo" in decision && decision.redirectTo) {
    redirect(listingUrl(decision.redirectTo));
  }
  if (decision.status !== 200) notFound();

  const locality = getLocalityBySlug(property.localitySlug, property.citySlug);
  const city = getCityBySlug(property.citySlug);
  // The PIN is the locality's primary code: a listing address sits inside one
  // of the locality's PINs, and the first is the registry's principal entry.
  const postalCode = locality?.pincodes[0];
  const coordinates = locality?.marker.split(",").map(Number);
  const trust = computeTrustScore(badgesToTrustInput(property.badge, property.status));
  const agent = buildAgentJsonLd(buildAgentProfile(demoBrokerSession));
  const schemaPrice = property.transaction === "rent" ? Number(property.price.replace(/[^0-9]/g, "")) : property.priceNum;
  // Contestant C §3 asks for the specific type, not the generic one: a flat is
  // an Apartment and a house is a SingleFamilyResidence. `Residence` stays only
  // as the honest fallback for anything we cannot type more precisely.
  const residenceType = residenceSchemaType(property.subtype);
  const residence = {
    "@type": residenceType,
    "@id": `${listingUrl(property.id)}#residence`,
    name: property.title,
    description: `${property.note} (Concept-preview demonstration listing — not a real offer.)`,
    ...(property.meaningfulUpdatedAt ? { dateModified: property.meaningfulUpdatedAt } : {}),
    numberOfRooms: property.bhk,
    numberOfBathroomsTotal: property.details.bathrooms,
    // FTK is the UN/CEFACT code for square foot. `unitCode` is what machines
    // read; `unitText` is the human label, so both ship rather than one.
    floorSize: { "@type": "QuantitativeValue", value: property.areaNum, unitCode: "FTK", unitText: "sq ft" },
    address: {
      "@type": "PostalAddress",
      addressLocality: property.locality,
      addressRegion: city?.state ?? "India",
      ...(postalCode ? { postalCode } : {}),
      addressCountry: "IN",
    },
    ...(coordinates && coordinates.length === 2 && coordinates.every(Number.isFinite)
      ? { geo: { "@type": "GeoCoordinates", latitude: coordinates[0], longitude: coordinates[1] } }
      : {}),
    image: assetUrl(`/images/${property.image}.jpg`),
    additionalProperty: [
      { "@type": "PropertyValue", name: "propertyType", value: property.subtype },
      { "@type": "PropertyValue", name: "parkingSpaces", value: property.details.parkingSpaces },
      { "@type": "PropertyValue", name: "furnishing", value: property.details.furnishing },
      { "@type": "PropertyValue", name: "facing", value: property.details.facing },
      { "@type": "PropertyValue", name: "amenities", value: property.details.amenities?.join(", ") ?? "" },
      { "@type": "PropertyValue", name: "trustScore", value: trust.score, unitText: "out of 100" },
      { "@type": "PropertyValue", name: "trustGrade", value: trust.grade },
      { "@type": "PropertyValue", name: "priceHistory", value: `${property.price}` },
      ...trust.signals.map((signal) => ({ "@type": "PropertyValue", name: signal.id, value: signal.met ? "verified" : "not-verified" })),
    ],
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      agent,
      {
        "@type": "RealEstateListing",
        "@id": `${listingUrl(property.id)}#listing`,
        url: listingUrl(property.id),
        name: property.title,
        description: property.meta,
        about: residence,
        image: [assetUrl(`/images/${property.image}.jpg`)],
        // Content-change date from the listing record (mirrors
        // Listing.meaningfulUpdatedAt), not the render clock — a re-crawl that
        // sees an unchanged date is a signal the page genuinely did not change.
        ...(property.meaningfulUpdatedAt ? { dateModified: property.meaningfulUpdatedAt } : {}),
        offers: {
          "@type": "Offer",
          price: schemaPrice,
          priceCurrency: "INR",
          availability: property.lifecycle === "SOLD" || property.lifecycle === "EXPIRED" ? "https://schema.org/Discontinued" : "https://schema.org/InStock",
          businessFunction: property.transaction === "rent" ? "http://purl.org/goodrelations/v1#LeaseOut" : "http://purl.org/goodrelations/v1#Sell",
          url: listingUrl(property.id),
        },
      },
      residence,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl() },
          // Resolved from the listing's own city, not a hard-coded launch city:
          // a Mumbai dossier must not publish an Ahmedabad breadcrumb, or the
          // trail — and every internal link Google reads from it — is wrong.
          {
            "@type": "ListItem",
            position: 2,
            name: city?.name ?? property.city,
            item: cityUrl(property.citySlug),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: property.locality,
            item: localityUrl(property.citySlug, property.localitySlug),
          },
          { "@type": "ListItem", position: 4, name: property.title, item: listingUrl(property.id) },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <ListingPage
        property={property}
        locality={locality}
        related={getRelatedListings(property.id, 3)}
        comparables={comparableListings({ id: property.id, localitySlug: property.localitySlug, priceNum: property.priceNum }, 3)}
        cityState={city?.state}
      />
    </>
  );
}
