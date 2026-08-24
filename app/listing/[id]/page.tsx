import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ListingPage from "@/pages/ListingPage";
import { properties } from "@/lib/properties";
import { findLocality } from "@/lib/localities";
import { assetUrl, cityUrl, homeUrl, listingUrl, localityUrl } from "@/lib/seo/urls";

export function generateStaticParams() {
  return properties.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const property = properties.find((p) => p.id === id);
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
  const property = properties.find((p) => p.id === id);
  if (!property) notFound();

  const locality = findLocality(property.localitySlug);
  const [lat, lon] = (locality?.marker ?? "23.011,72.559").split(",");
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
