/* /rent/ — the national rental hub.
 *
 * The counterpart to /buy/. The rent surface shipped with 12 city pages and 72
 * locality pages but no root, so this URL 404'd while /buy/ was the
 * highest-priority page in the sitemap: the entire rent branch had no entry
 * point above it, and truncating /rent/ahmedabad/ to /rent/ was a dead end.
 *
 * Everything that differs between the two intents comes from lib/seo/intent.ts
 * so the wording, schema and breadcrumbs cannot drift from the buy hub's.
 *
 * What this page does NOT do: claim rental coverage it does not have. Every
 * count is read from real listings, cities with no rental stock are listed
 * plainly as "no rentals yet" rather than linked into empty pages, and the SEO
 * registry's quality gate independently withholds this hub from the sitemap
 * while national rental inventory is zero. */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCities, getCitiesByState, getLocalities } from "@/lib/repositories";
import { getListingsForServer } from "@/lib/repositories/server/prisma";
import { canonicalUrl, cityUrl, homeUrl } from "@/lib/seo/urls";
import { intentVocabulary } from "@/lib/seo/intent";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";
import { rentHubSerpDescription, rentHubSerpTitle } from "@/lib/seo/serp";

const RENT = intentVocabulary("rent");

/* Built through the SERP helpers, not hand-written: they reserve room for the
   " \u00b7 Architech" suffix the root layout appends and keep the description
   inside its budget. The hand-written version shipped at 162 characters and the
   on-page audit caught it truncating mid-sentence. */
export function generateMetadata(): Metadata {
  return {
    title: rentHubSerpTitle(),
    description: rentHubSerpDescription(getCities().map((city) => city.name)),
    alternates: { canonical: canonicalUrl("/rent/") },
  };
}

export default async function RentIndiaHub() {
  /* One batched read per city, mirroring the buy hub: the national page must
     not issue N request-time queries. Rent and buy counts both come from the
     same read because the cross-intent link needs the buy figure too. */
  const rentCountByCity = new Map<string, number>();
  const buyCountByCity = new Map<string, number>();
  for (const city of getCities()) {
    const all = await getListingsForServer({ citySlug: city.slug });
    rentCountByCity.set(city.slug, all.filter((listing) => listing.transaction === "rent").length);
    buyCountByCity.set(city.slug, all.filter((listing) => listing.transaction !== "rent").length);
  }

  const cities = getCities();
  const groups = getCitiesByState();
  const totalRentals = [...rentCountByCity.values()].reduce((sum, n) => sum + n, 0);
  /* Cities with stock lead the ItemList: a hub's job is to route, and routing
     a renter into a city with nothing to rent wastes the click and the crawl. */
  const citiesWithRentals = cities.filter((city) => (rentCountByCity.get(city.slug) ?? 0) > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: "Indian cities with rental listings on Architech",
        /* Only cities that actually have rentals are itemised. Listing all 12
           here while half of them have no rental stock would describe coverage
           that does not exist. */
        numberOfItems: citiesWithRentals.length,
        itemListElement: citiesWithRentals.map((city, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: city.name,
          url: cityUrl(city.slug, "rent"),
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl() },
          { "@type": "ListItem", position: 2, name: "Rent property in India", item: canonicalUrl("/rent/") },
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
              <span className="ink-2">Rent property in India</span>
            </nav>
            <p className="kicker mt-12 text-brick">One country, {cities.length} markets · भारत</p>
            <h1 className="display mt-6 text-[clamp(44px,7vw,96px)]">Rent property in <em className="text-brick">India.</em></h1>
            <p className="mt-7 max-w-[620px] text-base leading-8 ink-2 md:text-lg">
              {totalRentals > 0
                ? `${totalRentals} rental ${totalRentals === 1 ? "home" : "homes"} across ${citiesWithRentals.length} of ${cities.length} cities — every figure is ${RENT.priceNoun}, with the same evidence standard applied everywhere.`
                : `Architech has mapped ${getLocalities().length} localities across ${cities.length} cities, but no rental listing has cleared verification yet. Rather than show an empty index, here is where to look next.`}
            </p>
            <p className="mt-6 text-sm ink-3">
              Looking to buy instead? <Link href={canonicalUrl("/buy/")} className="link-rail text-brick">Property for sale in India</Link>.
            </p>
          </div>
        </section>

        <section className="container py-14 md:py-20">
          {groups.map((group) => (
            <div key={group.stateSlug} className="mb-12">
              <h2 className="stamp ink-3">{group.state}</h2>
              <div className="mt-4 border-t border-ink/15">
                {group.cities.map((city) => {
                  const rentCount = rentCountByCity.get(city.slug) ?? 0;
                  const buyCount = buyCountByCity.get(city.slug) ?? 0;
                  const localityCount = getLocalities(city.slug).length;

                  /* A city with no rental stock is shown, not hidden — the
                     coverage claim stays honest — but it is NOT linked to its
                     /rent/ page, because the quality gate withholds that page
                     from the sitemap and linking to it would strand a crawler
                     on a URL the sitemap denies. The buy link is offered
                     instead, which is the useful answer for that city today. */
                  if (rentCount === 0) {
                    return (
                      <div key={city.slug} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-ink/15 py-6 md:grid-cols-[1.1fr_0.9fr_auto] md:gap-8">
                        <div>
                          <p className="font-display text-[26px] font-medium tracking-[-0.02em] ink-2 md:text-[34px]">
                            {city.name} <span className="ml-2 align-middle font-sans text-sm ink-3">{city.hindi}</span>
                          </p>
                          <p className="stamp mt-1 ink-3">{city.coords} · {city.reraAuthority}</p>
                        </div>
                        <p className="hidden text-sm ink-3 md:block">No rentals listed yet</p>
                        <div className="flex items-center gap-4">
                          {buyCount > 0 ? (
                            <Link href={cityUrl(city.slug, "buy")} className="stamp ink-3 underline-offset-4 hover:text-brick hover:underline">
                              {buyCount} to buy in {city.name}
                            </Link>
                          ) : (
                            <span className="stamp ink-3">{localityCount} localities mapped</span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={city.slug} className="border-b border-ink/15">
                      <Link
                        href={cityUrl(city.slug, "rent")}
                        className="group grid grid-cols-[1fr_auto] items-center gap-4 py-6 transition-colors hover:bg-sand/50 md:grid-cols-[1.1fr_0.9fr_auto] md:gap-8"
                      >
                        <div>
                          <p className="font-display text-[26px] font-medium tracking-[-0.02em] transition-transform duration-300 group-hover:translate-x-2 md:text-[34px]">
                            {city.name} <span className="ml-2 align-middle font-sans text-sm ink-3">{city.hindi}</span>
                          </p>
                          <p className="stamp mt-1 ink-3">{city.coords} · {city.reraAuthority}</p>
                        </div>
                        <p className="hidden text-sm ink-3 md:block">{city.tagline}</p>
                        <div className="flex items-center gap-4">
                          <span className="stamp ink-3">{localityCount} localities · {rentCount} to rent</span>
                          <span className="clay-fill group-hover:border-brick group-hover:bg-brick grid h-10 w-10 place-items-center border border-ink/20 text-ink transition-all duration-300">
                            <ArrowUpRight size={16} />
                          </span>
                        </div>
                      </Link>
                      {/* Sibling cross-link, mirroring the buy hub's rent link:
                          each intent page gets an inbound link from its closest
                          relative, so the pair is crawled as siblings. */}
                      {buyCount > 0 && (
                        <p className="-mt-2 pb-4">
                          <Link href={cityUrl(city.slug, "buy")} className="stamp ink-3 underline-offset-4 hover:text-brick hover:underline">
                            {buyCount} {buyCount === 1 ? "home" : "homes"} to buy in {city.name}
                          </Link>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="stamp ink-3">
            Coordinates © OpenStreetMap contributors · counts are illustrative for this concept preview · RERA authority shown is the state regulator that governs listings in that city
          </p>
        </section>
      </div>
    </>
  );
}
