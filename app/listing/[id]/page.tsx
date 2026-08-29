import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ListingPage from "@/pages/ListingPage";
import { getCityBySlug, getListingById, getListingStaticParams, getLocalityBySlug } from "@/lib/repositories";
import { assetUrl, cityUrl, homeUrl, listingUrl, localityUrl } from "@/lib/seo/urls";
import { httpDecisionForListing } from "@/lib/seo/lifecycle";
import { badgesToTrustInput, computeTrustScore } from "@/lib/trust/score";
import { buildAgentJsonLd, buildAgentProfile } from "@/lib/agent/profile";
import { demoBrokerSession } from "@/lib/auth/roles";

export function generateStaticParams() {
  return getListingStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const property = getListingById(id);
  if (!property) return { title: "Not found" };
  const metadataDecision = httpDecisionForListing(property.lifecycle, property.id, { continuingValue: property.continuingSeoValue });
  return {
    title: `${property.title} — ${property.price}`,
    description: `${property.meta} · ${property.area} · ${property.locality}, ${property.city}. ${property.note} ${property.badge}, ${property.status.toLowerCase()}.`,
    alternates: { canonical: listingUrl(property.id) },
    robots: { index: metadataDecision.indexable, follow: true },
    openGraph: { title: `${property.title} — ${property.price}`, url: listingUrl(property.id), images: [{ url: assetUrl(`/images/${property.image}.jpg`) }] },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = getListingById(id);
  if (!property) notFound();

  // Enforce listing-indexability per the SEO-004 lifecycle contract. A non-ACTIVE
  // listing resolves to notFound (404) / a permanent redirect here; a DUPLICATE
  // listing redirects to its canonical stable id. Fixtures default to ACTIVE so
  // this is a safety net for future lifecycle-aware data.
  const decision = httpDecisionForListing(property.lifecycle, property.id, { continuingValue: property.continuingSeoValue });
  if (decision.status === 301 && "redirectTo" in decision && decision.redirectTo) {
    redirect(listingUrl(decision.redirectTo));
  }
  if (decision.status !== 200) notFound();

  const locality = getLocalityBySlug(property.localitySlug);
  const city = getCityBySlug(property.citySlug);
  // The PIN is the locality's primary code: a listing address sits inside one
  // of the locality's PINs, and the first is the registry's principal entry.
  const postalCode = locality?.pincodes[0];
  const [lat, lon] = (locality?.marker ?? "23.011,72.559").split(",");
  const trust = computeTrustScore(badgesToTrustInput(property.badge, property.status));
  const agent = buildAgentJsonLd(buildAgentProfile(demoBrokerSession));
  const schemaPrice = property.transaction === "rent" ? Number(property.price.replace(/[^0-9]/g, "")) : property.priceNum;
  const residence = {
    "@type": "Residence",
    "@id": `${listingUrl(property.id)}#residence`,
    name: property.title,
    description: `${property.note} (Concept-preview demonstration listing — not a real offer.)`,
    ...(property.meaningfulUpdatedAt ? { dateModified: property.meaningfulUpdatedAt } : {}),
    numberOfRooms: property.bhk,
    numberOfBathroomsTotal: property.details.bathrooms,
    floorSize: { "@type": "QuantitativeValue", value: property.areaNum, unitText: "sq ft" },
    address: {
      "@type": "PostalAddress",
      addressLocality: property.locality,
      addressRegion: city?.state ?? "India",
      ...(postalCode ? { postalCode } : {}),
      addressCountry: "IN",
    },
    geo: { "@type": "GeoCoordinates", latitude: Number(lat), longitude: Number(lon) },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ListingPage id={property.id} />
    </>
  );
}
