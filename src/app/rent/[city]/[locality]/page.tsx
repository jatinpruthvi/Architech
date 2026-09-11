/* /rent/{city}/{locality}/ — the hyperlocal rental page.
 *
 * The highest-intent rental surface: "2 bhk for rent in Bopal" is where rental
 * search actually converges, and until now it had no URL at all.
 *
 * Deliberately NOT a copy of the buy locality page with a filter bolted on.
 * The buy page renders `CityPage`, a rich showcase that pads a thin locality
 * with listings from elsewhere in the city — correct for a browse surface,
 * wrong here. Padding a rental page with sale listings from other localities
 * is how a page ends up ranking for a query it cannot answer, and it is
 * exactly the doorway-page pattern the quality gate exists to catch.
 *
 * So this page publishes rental stock in THIS locality, and when there is none
 * it says so and routes the user somewhere useful. That is the honest version,
 * and it is also the one that survives a manual review. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLiveCityBySlug, getLocalities, getLocalityBySlug, getLocalityStaticParams } from "@/lib/repositories";
import { getListingsByLocalityForServer } from "@/lib/repositories/server/prisma";
import { isIndexable } from "@/lib/seo/lifecycle";
import { cityUrl, homeUrl, listingUrl, localityUrl } from "@/lib/seo/urls";
import { intentVocabulary } from "@/lib/seo/intent";
import { buildFaqPage, localityFaqEntries } from "@/lib/seo/faq";
import { FaqSection } from "@/components/architech/FaqSection";
import { localityIntel } from "@/lib/realestate/locality-intel";
import { compactInr } from "@/lib/realestate/format-inr";
import { socialImage } from "@/lib/seo/social";
import { serializeJsonLd } from "@/lib/seo/jsonld-serialize";
import { rentLocalitySerpDescription, rentLocalitySerpTitle } from "@/lib/seo/serp";
import { cityNode, localityId } from "@/lib/seo/entity-graph";
import PropertyCard from "@/components/architech/PropertyCard";

const RENT = intentVocabulary("rent");

export function generateStaticParams() {
  return getLocalityStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ city: string; locality: string }> }): Promise<Metadata> {
  const { city: citySlug, locality: slug } = await params;
  const city = getLiveCityBySlug(citySlug);
  const locality = city ? getLocalityBySlug(slug, city.slug) : undefined;
  if (!city || !locality) return { title: "Not found" };
  /* Same fix as the rent city hub: budget-aware, single brand suffix. */
  const title = rentLocalitySerpTitle({ name: locality.name, cityName: city.name, pincodes: locality.pincodes, note: locality.note });
  const canonical = localityUrl(city.slug, locality.slug, "rent");
  return {
    title,
    description: rentLocalitySerpDescription({ name: locality.name, cityName: city.name, pincodes: locality.pincodes, note: locality.note }),
    alternates: { canonical },
    openGraph: { title, url: canonical, images: [socialImage("locality-street")] },
  };
}

export default async function RentLocalityPage({ params }: { params: Promise<{ city: string; locality: string }> }) {
  const { city: citySlug, locality: slug } = await params;
  const city = getLiveCityBySlug(citySlug);
  const locality = city ? getLocalityBySlug(slug, city.slug) : undefined;
  if (!city || !locality) notFound();

  const [lat, lon] = locality.marker.split(",");
  const all = await getListingsByLocalityForServer(locality.slug, city.slug);
  /* Rental stock in THIS locality, indexable only. No padding from elsewhere. */
  const listings = all.filter(
    (listing) => listing.transaction === "rent" && isIndexable(listing.lifecycle ?? "ACTIVE"),
  );
  const nearby = getLocalities(city.slug).filter((item) => item.slug !== locality.slug).slice(0, 5);
  const intel = localityIntel(locality.slug, city.slug);

  /* FAQ entries generated from this locality's OWN facts. Each generator
     returns nothing when its fact is missing, so a bare locality produces too
     few entries and `buildFaqPage` returns null rather than emitting a
     templated FAQ across 72 pages. Whatever is generated is also RENDERED
     below — Google requires FAQ markup to match visible content. */
  const faqEntries = localityFaqEntries({
    localityName: locality.name,
    cityName: city.name,
    stateName: city.state,
    reraAuthority: city.reraAuthority,
    pincodes: locality.pincodes,
    landmarks: (locality.landmarks ?? []).map(([name]) => name),
    saleCount: all.filter((l) => l.transaction !== "rent" && isIndexable(l.lifecycle ?? "ACTIVE")).length,
    rentCount: listings.length,
    /* Rent median, never the sale median. `medianMonthlyRentInr` is null when
       the rental sample is too small to publish, and passing that null simply
       drops the question rather than printing a figure one listing wide. */
    medianPriceLabel:
      intel.medianMonthlyRentInr === null ? null : `${compactInr(intel.medianMonthlyRentInr)} per month`,
    intent: "rent",
    asOfDate: intel.asOfDate,
  });
  const faq = buildFaqPage(faqEntries, localityUrl(city.slug, locality.slug, "rent"));

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
        geo: { "@type": "GeoCoordinates", latitude: Number(lat), longitude: Number(lon) },
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
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl() },
          { "@type": "ListItem", position: 2, name: `Rent in ${city.name}`, item: cityUrl(city.slug, "rent") },
          { "@type": "ListItem", position: 3, name: locality.name, item: localityUrl(city.slug, locality.slug, "rent") },
        ],
      },
      ...(listings.length
        ? [
            {
              "@type": "ItemList",
              name: `Homes to rent in ${locality.name}, ${city.name}`,
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
      <div className="bg-paper pt-[78px] text-ink">
        <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
          <div className="container">
            <nav className="flex flex-wrap items-center gap-2 stamp ink-3" aria-label="Breadcrumb">
              <Link href="/" className="link-rail hover:text-brick">Home</Link><span>/</span>
              <Link href={cityUrl(city.slug, "rent")} className="link-rail hover:text-brick">Rent in {city.name}</Link><span>/</span>
              <span className="ink-2">{locality.name}</span>
            </nav>
            <p className="kicker mt-12 text-brick">{locality.hindi} · {city.name}</p>
            <h1 className="display mt-6 text-[clamp(40px,6vw,84px)]">
              Rent in <em className="text-brick">{locality.name}.</em>
            </h1>
            <p className="mt-7 max-w-[600px] text-base leading-8 ink-2 md:text-lg">{locality.note}</p>
            <p className="stamp mt-5 ink-3">
              {locality.coords}
              {locality.pincodes.length ? ` · PIN ${locality.pincodes.join(", ")}` : ""}
            </p>
            <p className="mt-6 text-sm ink-3">
              Looking to buy here instead?{" "}
              <Link href={localityUrl(city.slug, locality.slug, "buy")} className="link-rail text-brick">
                Homes for sale in {locality.name}
              </Link>.
            </p>
          </div>
        </section>

        <section className="container py-14 md:py-20">
          <h2 className="font-display text-[28px] font-medium tracking-[-0.02em] md:text-[38px]">
            {listings.length > 0
              ? `${listings.length} ${listings.length === 1 ? "home" : "homes"} to rent`
              : `No rentals in ${locality.name} yet`}
          </h2>
          {listings.length > 0 ? (
            <>
              <p className="mt-4 max-w-[600px] text-sm leading-7 ink-3">
                Every figure below is {RENT.priceNoun}. Verification and source date are stated on each dossier.
              </p>
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((listing) => (
                  <PropertyCard key={listing.id} property={listing} />
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 max-w-[600px] text-base leading-8 ink-2">
              Architech has {locality.name} mapped — coordinates, PIN codes and locality context are all in place — but no
              rental listing here has cleared verification yet. We would rather show you an honest empty page than an
              inventory we cannot stand behind.
            </p>
          )}

          <div className="mt-14 border-t border-ink/15 pt-8">
            <p className="stamp ink-3">Nearby localities</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              {nearby.map((place) => (
                <Link key={place.slug} href={localityUrl(city.slug, place.slug, "rent")} className="link-rail text-sm text-brick">
                  Rent in {place.name}
                </Link>
              ))}
            </div>
            <p className="mt-8 text-sm ink-3">
              <Link href={cityUrl(city.slug, "rent")} className="link-rail text-brick">All rentals in {city.name}</Link>
              {" · "}
              <Link href="/requirements/" className="link-rail text-brick">Tell us what you are looking for</Link>
            </p>
          </div>
        </section>
        {faq && (
          <FaqSection
            entries={faqEntries}
            heading={`Renting in ${locality.name}: common questions`}
          />
        )}
      </div>
    </>
  );
}
