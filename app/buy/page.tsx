import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCities, getCitiesByState, getLocalities } from "@/lib/repositories";
import { getListingsForServer } from "@/lib/repositories/server/prisma";
import { canonicalUrl, cityUrl, homeUrl } from "@/lib/seo/urls";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";

export const metadata: Metadata = {
  title: "Buy property in India — every city we cover",
  description:
    "Architech covers 12 metros and major markets: Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Pune, Kolkata, Ahmedabad, Gurugram, Noida, Surat and Jaipur.",
  alternates: { canonical: canonicalUrl("/buy/") },
};

/* National hub: Home → /buy/ → city → locality. This is the crawl entry point
   that distributes authority to every city hub (architecture: internal links). */
export default async function BuyIndiaHub() {
  /* Server-mode listing counts: prisma reads the live table, fixture mode
     returns the same fixtures the static counts did. One batched read per
     city keeps the national hub from issuing N request-time queries. */
  const listingCountByCity = new Map<string, number>();
  for (const city of getCities()) {
    listingCountByCity.set(city.slug, (await getListingsForServer({ citySlug: city.slug })).length);
  }
  const cities = getCities();
  const groups = getCitiesByState();
  const totalLocalities = getLocalities().length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: "Cities covered by Architech",
        numberOfItems: cities.length,
        itemListElement: cities.map((city, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: city.name,
          url: cityUrl(city.slug),
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl() },
          { "@type": "ListItem", position: 2, name: "Buy property in India", item: canonicalUrl("/buy/") },
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
              <span className="text-ink/80">Buy property in India</span>
            </nav>
            <p className="kicker mt-12 text-brick">One country, {cities.length} markets · भारत</p>
            <h1 className="display mt-6 text-[clamp(44px,7vw,96px)]">Buy property in <em className="text-brick">India.</em></h1>
            <p className="mt-7 max-w-[620px] text-base leading-8 text-ink/65 md:text-lg">
              {totalLocalities} localities across {cities.length} cities and {groups.length} states — each with verified coordinates, state-RERA context, and the same evidence standard applied everywhere.
            </p>
          </div>
        </section>

        <section className="container py-14 md:py-20">
          {groups.map((group) => (
            <div key={group.stateSlug} className="mb-12">
              <h2 className="stamp !text-[11px] text-ink/60">{group.state}</h2>
              <div className="mt-4 border-t border-ink/15">
                {group.cities.map((city) => {
                  const localityCount = getLocalities(city.slug).length;
                  const listingCount = listingCountByCity.get(city.slug) ?? 0;
                  return (
                    <Link
                      key={city.slug}
                      href={`/buy/${city.slug}/`}
                      className="group grid grid-cols-[1fr_auto] items-center gap-4 border-b border-ink/15 py-6 transition-colors hover:bg-sand/50 md:grid-cols-[1.1fr_0.9fr_auto] md:gap-8"
                    >
                      <div>
                        <p className="font-display text-[26px] font-medium tracking-[-0.02em] transition-transform duration-300 group-hover:translate-x-2 md:text-[34px]">
                          {city.name} <span className="ml-2 align-middle font-sans text-sm text-ink/55">{city.hindi}</span>
                        </p>
                        <p className="stamp mt-1 !text-[10px] text-ink/60">{city.coords} · {city.reraAuthority}</p>
                      </div>
                      <p className="hidden text-sm text-ink/55 md:block">{city.tagline}</p>
                      <div className="flex items-center gap-4">
                        <span className="stamp !text-[11px] text-ink/60">{localityCount} localities · {listingCount} homes</span>
                        <span className="clay-fill group-hover:border-brick group-hover:bg-brick grid h-10 w-10 place-items-center border border-ink/20 text-ink transition-all duration-300">
                          <ArrowUpRight size={16} />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="stamp !text-[10px] text-ink/60">
            Coordinates © OpenStreetMap contributors · counts are illustrative for this concept preview · RERA authority shown is the state regulator that governs listings in that city
          </p>
        </section>
      </div>
    </>
  );
}
