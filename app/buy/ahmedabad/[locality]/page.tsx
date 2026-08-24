import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CityPage from "@/pages/CityPage";
import { findLocality, localities } from "@/lib/localities";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://architech-demo.example.com";

export function generateStaticParams() {
  return localities.map((l) => ({ locality: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locality: string }> }): Promise<Metadata> {
  const { locality: slug } = await params;
  const locality = findLocality(slug);
  if (!locality) return { title: "Not found" };
  return {
    title: `${locality.name}, Ahmedabad — homes & locality context`,
    description: `Homes in ${locality.name} (${locality.hindi}), Ahmedabad: ${locality.note.toLowerCase()}. RERA-checked inventory, verified coordinates (${locality.coords}), and real distances.`,
    alternates: { canonical: `/buy/ahmedabad/${locality.slug}/` },
    openGraph: { title: `${locality.name}, Ahmedabad`, url: `/buy/ahmedabad/${locality.slug}/`, images: [{ url: "/images/locality-street.jpg" }] },
  };
}

export default async function Page({ params }: { params: Promise<{ locality: string }> }) {
  const { locality: slug } = await params;
  const locality = findLocality(slug);
  if (!locality) notFound();

  const [lat, lon] = locality.marker.split(",");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Place",
        name: `${locality.name}, Ahmedabad`,
        alternateName: locality.hindi,
        geo: { "@type": "GeoCoordinates", latitude: Number(lat), longitude: Number(lon) },
        containedInPlace: { "@type": "City", name: "Ahmedabad" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Buy in Ahmedabad", item: `${SITE_URL}/buy/ahmedabad/` },
          { "@type": "ListItem", position: 3, name: locality.name, item: `${SITE_URL}/buy/ahmedabad/${locality.slug}/` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CityPage localitySlug={locality.slug} />
    </>
  );
}
