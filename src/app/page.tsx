import type { Metadata } from "next";
import Home from "@/screens/Home";
import { getCities, getLocalities } from "@/lib/repositories";
import { getListingsForServer } from "@/lib/repositories/server/prisma";
import { orderFeaturedFirst } from "@/lib/repositories/featured-order";
import { exampleQuery, popularQueries } from "@/lib/search/suggest";
import { formatBudget } from "@/lib/search/parse-query";
import { homeUrl } from "@/lib/seo/urls";
import type { Property } from "@/lib/repositories";

/* The root layout carries no canonical default (a default would masquerade as
   the homepage on every route that forgot its own), so home says it itself. */
export const metadata: Metadata = {
  alternates: { canonical: homeUrl() },
};

const showcaseCities = ["mumbai", "bengaluru", "ahmedabad"];

function heroPresets(listings: Property[]) {
  const buyPrices = listings
    .filter(listing => (listing.transaction ?? "buy") === "buy")
    .map(listing => listing.priceNum)
    .sort((a, b) => a - b);
  const at = (fraction: number) =>
    buyPrices[Math.floor(buyPrices.length * fraction)] ?? 0;
  const round = (value: number) =>
    Math.max(5_000_000, Math.round(value / 2_500_000) * 2_500_000);
  const cheap = round(at(0.25));
  const mid = round(at(0.6));
  const presets = [
    {
      query: `under ${cheap / 10_000_000} cr`,
      label: `Under ${formatBudget(cheap)}`,
    },
  ];
  if (mid > cheap)
    presets.push({
      query: `under ${mid / 10_000_000} cr`,
      label: `Under ${formatBudget(mid)}`,
    });
  presets.push({ query: "ready to move", label: "Ready to move" });
  return presets;
}

export default async function Page() {
  /* Server-mode reads: prisma when ARCHITECH_DATA_SOURCE=prisma (the public
     site then publishes exactly the inventory the database holds), fixture
     adapter otherwise — identical output for the CI/demo build.

     The two reads are independent (different scopes, different caps), so they
     go out together: this page used to await one after the other, and each
     read is a full inventory query with its relation includes. */
  const [allListings, showcaseListings] = await Promise.all([
    getListingsForServer({}),
    getListingsForServer({
      citySlugs: showcaseCities,
      limit: showcaseCities.length * 100,
    }),
  ]);
  /* Featured is derived from the pool already in hand (PERF-R5-001): the old
     `await getFeaturedListingsForServer(6)` re-issued this exact nationwide
     read — same where clause, same ceiling, same order — just to pick six of
     the rows it had already fetched. The ordering rule is unchanged and shared
     with both adapters (`orderFeaturedFirst`). */
  const featuredListings = orderFeaturedFirst(allListings, 6);
  const showcaseListingsByCity = new Map<string, Property[]>();
  for (const citySlug of showcaseCities) {
    showcaseListingsByCity.set(citySlug, []);
  }
  for (const listing of showcaseListings) {
    if (showcaseListingsByCity.has(listing.citySlug)) {
      showcaseListingsByCity.get(listing.citySlug)!.push(listing);
    }
  }
  const cities = getCities().map(city => ({
    slug: city.slug,
    name: city.name,
    hindi: city.hindi,
    state: city.state,
    coords: city.coords,
    tagline: city.tagline,
    localityCount: getLocalities(city.slug).length,
  }));
  return (
    <Home
      featured={featuredListings}
      listingCount={allListings.length}
      localityCount={getLocalities().length}
      cityCount={cities.length}
      cities={cities}
      popularSearches={popularQueries({}, 4)}
      heroPresets={heroPresets(allListings)}
      example={exampleQuery()}
      marketProjects={showcaseCities
        .flatMap(citySlug =>
          (showcaseListingsByCity.get(citySlug) ?? []).slice(0, 1)
        )
        .map(listing => ({
          name: listing.project,
          developer: listing.developer,
          locality: `${listing.locality}, ${listing.city}`,
          href: `/listing/${listing.id}/`,
          label: listing.badge,
        }))}
      marketLocalityLinks={getCities().flatMap(city => {
        const locality = getLocalities(city.slug)[0];
        return locality
          ? [
              {
                slug: locality.slug,
                name: locality.name,
                citySlug: city.slug,
                cityName: city.name,
              },
            ]
          : [];
      })}
    />
  );
}
