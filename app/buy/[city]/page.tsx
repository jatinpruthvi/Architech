import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getCityStaticParams, getLiveCityBySlug, getLocalities } from "@/lib/repositories";
import { cityUrl, homeUrl } from "@/lib/seo/urls";
import { cityTrustSummary } from "@/lib/trust/locality";
import { citySerpDescription, citySerpTitle } from "@/lib/seo/serp";
import { LocalityTrust } from "@/components/architech/LocalityTrust";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

export function generateStaticParams() {
  return getCityStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getLiveCityBySlug(citySlug);
  if (!city) return { title: "Not found" };
  const localities = getLocalities(city.slug);
  const title = citySerpTitle(city);
  return {
    title,
    description: citySerpDescription({ ...city, localities: localities.map((locality) => locality.name) }),
    alternates: { canonical: cityUrl(city.slug) },
  };
}

/* Server-rendered, fully crawlable city hub (architecture: Home → hubs → cities → localities). */
export default async function CityHub({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params;
  const city = getLiveCityBySlug(citySlug);
  if (!city) notFound();

  const localities = getLocalities(city.slug);
  const trust = cityTrustSummary(city.slug);
  const [lat, lon] = city.marker.split(",");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "City",
        name: city.name,
        alternateName: city.hindi,
        geo: { "@type": "GeoCoordinates", latitude: Number(lat), longitude: Number(lon) },
        containedInPlace: { "@type": "AdministrativeArea", name: city.state },
        additionalProperty: [
          { "@type": "PropertyValue", name: "trustScore", value: trust.avgScore, unitText: "out of 100" },
          { "@type": "PropertyValue", name: "trustGrade", value: trust.grade },
          { "@type": "PropertyValue", name: "reraCoveragePct", value: trust.reraCoveragePct },
          { "@type": "PropertyValue", name: "sourceReviewedCount", value: trust.sourceReviewed },
          { "@type": "PropertyValue", name: "reraAuthority", value: city.reraAuthority },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl() },
          { "@type": "ListItem", position: 2, name: `Buy in ${city.name}`, item: cityUrl(city.slug) },
        ],
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <nav className="flex flex-wrap items-center gap-2 stamp !text-[11px] text-ink/60" aria-label="Breadcrumb">
            <Link href="/" className="link-rail hover:text-brick">Home</Link><span>/</span>
            <Link href="/buy/" className="link-rail hover:text-brick">Cities</Link><span>/</span>
            <span className="text-ink/80">Buy in {city.name}</span>
          </nav>
          <p className="kicker mt-12 text-brick">The city, locality by locality · {city.hindi}</p>
          <h1 className="display mt-6 text-[clamp(44px,7vw,96px)]">Buy in <em className="text-brick">{city.name}.</em></h1>
          <p className="mt-7 max-w-[560px] text-base leading-8 text-ink/65 md:text-lg">
            {localities.length} {localities.length === 1 ? "locality" : "localities"} mapped so far in {city.state} — each with verified coordinates, {city.reraAuthority}-checked inventory, and the context that makes an address make sense.
          </p>
        </div>
      </section>
      <section className="container py-14 md:py-20">
        <div className="border-t border-ink/15">
          {localities.map((place, i) => (
            <Link key={place.slug} href={`/buy/${city.slug}/${place.slug}/`} className="group grid grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-ink/15 py-6 transition-colors hover:bg-sand/50 md:grid-cols-[90px_1.1fr_0.9fr_auto] md:gap-8 md:py-7">
              <span className="index-num text-[28px] text-ink/25 transition-colors group-hover:text-brick md:text-[44px]">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="font-display text-[26px] font-medium tracking-[-0.02em] transition-transform duration-300 group-hover:translate-x-2 md:text-[34px]">{place.name} <span className="ml-2 align-middle font-sans text-sm text-ink/55">{place.hindi}</span></p>
                <p className="stamp mt-1 !text-[10px] text-ink/60">{place.coords}</p>
              </div>
              <p className="hidden text-sm text-ink/55 md:block">{place.note}</p>
              <div className="flex items-center gap-4">
                <span className="stamp !text-[11px] text-ink/60">{place.homes} homes</span>
                <span className="clay-fill group-hover:border-brick group-hover:bg-brick grid h-10 w-10 place-items-center border border-ink/20 text-ink transition-all duration-300"><ArrowUpRight size={16} /></span>
              </div>
            </Link>
          ))}
        </div>
        <p className="stamp mt-6 !text-[10px] text-ink/60">Coordinates © OpenStreetMap contributors · home counts are illustrative for this concept preview</p>
        <LocalityTrust summary={trust} />
        <p className="mt-10 text-sm text-ink/60">
          Looking elsewhere? <Link href="/buy/" className="link-rail text-brick">Browse every city Architech covers</Link>.
        </p>
      </section>
    </div>
    </>
  );
}
