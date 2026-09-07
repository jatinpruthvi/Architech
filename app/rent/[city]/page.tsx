/* /rent/{city}/ — the rental city hub.
 *
 * The counterpart to /buy/{city}/. These are deliberately SEPARATE URLs rather
 * than one page with a filter: "flats for rent in Ahmedabad" and "flats for
 * sale in Ahmedabad" are different queries with different intent and different
 * price semantics, and a single URL cannot be the canonical answer to both.
 *
 * Everything that differs between the two intents lives in `lib/seo/intent.ts`
 * so the wording, schema and breadcrumbs cannot drift apart.
 *
 * Note what this page does NOT do: it does not claim rental inventory it does
 * not have. The listing count is read from real data, and when a city has no
 * rental listings the page says so plainly instead of rendering an empty grid
 * that looks broken. The SEO registry's quality gate independently withholds
 * such a page from the sitemap. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getCityStaticParams, getLiveCityBySlug, getListingsByCity, getLocalities } from "@/lib/repositories";
import { cityUrl, homeUrl } from "@/lib/seo/urls";
import { intentVocabulary } from "@/lib/seo/intent";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";
import { cityId, cityNode } from "@/lib/seo/entity-graph";

const RENT = intentVocabulary("rent");

export function generateStaticParams() {
  return getCityStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getLiveCityBySlug(citySlug);
  if (!city) return { title: "Not found" };
  const rentals = getListingsByCity(city.slug).filter((listing) => listing.transaction === "rent");
  return {
    title: `Property for rent in ${city.name} — ${city.state} rentals | Architech`,
    description: `Homes and flats to rent in ${city.name}, ${city.state}. ${rentals.length} verified rental ${rentals.length === 1 ? "listing" : "listings"} with monthly rent, locality context, and ${city.reraAuthority} checks.`,
    alternates: { canonical: cityUrl(city.slug, "rent") },
  };
}

export default async function RentCityHub({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params;
  const city = getLiveCityBySlug(citySlug);
  if (!city) notFound();

  const localities = getLocalities(city.slug);
  const rentals = getListingsByCity(city.slug).filter((listing) => listing.transaction === "rent");
  /* Only localities that actually have rental stock get a row. A locality link
     that leads to an empty rental page is a thin page and a wasted crawl. */
  const rentalLocalities = localities.filter((place) =>
    rentals.some((listing) => listing.localitySlug === place.slug),
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      /* A REFERENCE to the city defined on its buy hub -- not a second
         description of it. The rent hub is a different page about the same
         place; emitting its own City node here is exactly how one city becomes
         two competing entities. Geo and containment live at the definition
         site. */
      cityNode({ slug: city.slug, name: city.name, state: city.state, stateSlug: city.stateSlug }),
      {
        "@type": "CollectionPage",
        name: `Property for rent in ${city.name}`,
        url: cityUrl(city.slug, "rent"),
        /* LeaseOut, not Sell — the distinction that stops an aggregator
           reading a ₹22,000 monthly figure as a sale price. */
        about: { "@id": cityId(city.slug) },
        numberOfItems: rentals.length,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl() },
          { "@type": "ListItem", position: 2, name: `Rent in ${city.name}`, item: cityUrl(city.slug, "rent") },
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
            <nav className="flex flex-wrap items-center gap-2 stamp ink-3" aria-label="Breadcrumb">
              <Link href="/" className="link-rail hover:text-brick">Home</Link><span>/</span>
              <Link href="/buy/" className="link-rail hover:text-brick">Cities</Link><span>/</span>
              <span className="ink-2">Rent in {city.name}</span>
            </nav>
            <p className="kicker mt-12 text-brick">Rentals, locality by locality · {city.hindi}</p>
            <h1 className="display mt-6 text-[clamp(44px,7vw,96px)]">Rent in <em className="text-brick">{city.name}.</em></h1>
            <p className="mt-7 max-w-[560px] text-base leading-8 ink-2 md:text-lg">
              {rentals.length > 0
                ? `${rentals.length} rental ${rentals.length === 1 ? "home" : "homes"} across ${rentalLocalities.length} ${rentalLocalities.length === 1 ? "locality" : "localities"} in ${city.state} — every figure is ${RENT.priceNoun}, with the locality context that makes an address make sense.`
                : `Architech has mapped ${localities.length} ${localities.length === 1 ? "locality" : "localities"} in ${city.name}, but no rental listing here has cleared verification yet. Rather than show an empty grid, here is where to look next.`}
            </p>
            <p className="mt-6 text-sm ink-3">
              Looking to buy instead? <Link href={cityUrl(city.slug, "buy")} className="link-rail text-brick">Property for sale in {city.name}</Link>.
            </p>
          </div>
        </section>

        <section className="container py-14 md:py-20">
          {rentalLocalities.length > 0 ? (
            <div className="border-t border-ink/15">
              {rentalLocalities.map((place, i) => {
                const count = rentals.filter((listing) => listing.localitySlug === place.slug).length;
                return (
                  <Link
                    key={place.slug}
                    href={`/rent/${city.slug}/${place.slug}/`}
                    className="group grid grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-ink/15 py-6 transition-colors hover:bg-sand/50 md:grid-cols-[90px_1.1fr_0.9fr_auto] md:gap-8 md:py-7"
                  >
                    <span className="index-num text-[28px] ink-3 transition-colors group-hover:text-brick md:text-[44px]">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <p className="font-display text-[26px] font-medium tracking-[-0.02em] transition-transform duration-300 group-hover:translate-x-2 md:text-[34px]">
                        {place.name} <span className="ml-2 align-middle font-sans text-sm ink-3">{place.hindi}</span>
                      </p>
                      <p className="stamp mt-1 ink-3">{place.coords}</p>
                    </div>
                    <p className="hidden text-sm ink-3 md:block">{place.note}</p>
                    <div className="flex items-center gap-4">
                      <span className="stamp ink-3">{count} to rent</span>
                      <span className="clay-fill group-hover:border-brick group-hover:bg-brick grid h-10 w-10 place-items-center border border-ink/20 text-ink transition-all duration-300"><ArrowUpRight size={16} /></span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="border-t border-ink/15 py-10">
              <p className="text-base leading-8 ink-2">
                No verified rental listings in {city.name} yet. Rental stock appears here as soon as it clears the same
                verification every Architech listing goes through — we would rather show you nothing than show you a
                listing we cannot stand behind.
              </p>
              <p className="mt-6 text-sm ink-3">
                In the meantime: <Link href={cityUrl(city.slug, "buy")} className="link-rail text-brick">homes for sale in {city.name}</Link>
                {" · "}
                <Link href="/requirements/" className="link-rail text-brick">tell us what you are looking for</Link>
              </p>
            </div>
          )}

          <p className="mt-10 text-sm ink-3">
            Renting elsewhere? <Link href="/buy/" className="link-rail text-brick">Browse every city Architech covers</Link>.
          </p>
        </section>
      </div>
    </>
  );
}
