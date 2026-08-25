import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ListingPage from "@/pages/ListingPage";
import { getListingById, getListingStaticParams, getLocalityBySlug } from "@/lib/repositories";
import { assetUrl, cityUrl, homeUrl, listingUrl, localityUrl } from "@/lib/seo/urls";
import { httpDecisionForListing } from "@/lib/seo/lifecycle";
import { badgesToTrustInput, computeTrustScore } from "@/lib/trust/score";

export function generateStaticParams() {
  return getListingStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const property = getListingById(id);
  if (!property) return { title: "Not found" };
  return {
    title: `${property.title} — ${property.price}`,
    description: `${property.meta} · ${property.area} · ${property.locality}, Ahmedabad. ${property.note} ${property.badge}, ${property.status.toLowerCase()}.`,
    alternates: { canonical: listingUrl(property.id) },
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
  const decision = httpDecisionForListing(property.lifecycle, property.id);
  if (decision.status === 301 && "redirectTo" in decision && decision.redirectTo) {
    redirect(listingUrl(decision.redirectTo));
  }
  if (decision.status !== 200) notFound();

  const locality = getLocalityBySlug(property.localitySlug);
  const [lat, lon] = (locality?.marker ?? "23.011,72.559").split(",");
  const trust = computeTrustScore(badgesToTrustInput(property.badge, property.status));
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Residence",
        name: property.title,
        description: `${property.note} (Concept-preview demonstration listing — not a real offer.)`,
        numberOfRooms: property.bhk,
        floorSize: { "@type": "QuantitativeValue", value: property.areaNum, unitText: "sq ft" },
        address: { "@type": "PostalAddress", addressLocality: property.locality, addressRegion: "Gujarat", addressCountry: "IN" },
        geo: { "@type": "GeoCoordinates", latitude: Number(lat), longitude: Number(lon) },
        image: assetUrl(`/images/${property.image}.jpg`),
        additionalProperty: [
          { "@type": "PropertyValue", name: "trustScore", value: trust.score, unitText: "out of 100" },
          { "@type": "PropertyValue", name: "trustGrade", value: trust.grade },
          ...trust.signals.map((signal) => ({ "@type": "PropertyValue", name: signal.id, value: signal.met ? "verified" : "not-verified" })),
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl() },
          { "@type": "ListItem", position: 2, name: "Ahmedabad", item: cityUrl("ahmedabad") },
          { "@type": "ListItem", position: 3, name: property.locality, item: localityUrl("ahmedabad", property.localitySlug) },
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
