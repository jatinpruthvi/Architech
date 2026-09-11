import type { Metadata } from "next";
import Home from "@/pages/Home";
import { getCities, getLocalities } from "@/lib/repositories";
import { getFeaturedListingsForServer, getListingsForServer } from "@/lib/repositories/server/prisma";
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
    .filter((listing) => (listing.transaction ?? "buy") === "buy")
    .map((listing) => listing.priceNum)
    .sort((a, b) => a - b);
  const at = (fraction: number) => buyPrices[Math.floor(buyPrices.length * fraction)] ?? 0;
  const round = (value: number) => Math.max(5_000_000, Math.round(value / 2_500_000) * 2_500_000);
  const cheap = round(at(0.25));
  const mid = round(at(0.6));
  const presets = [{ query: `under ${cheap / 10_000_000} cr`, label: `Under ${formatBudget(cheap)}` }];
  if (mid > cheap) presets.push({ query: `under ${mid / 10_000_000} cr`, label: `Under ${formatBudget(mid)}` });
  presets.push({ query: "ready to move", label: "Ready to move" });
  return presets;
}

export default async function Page() {
  /* Server-mode reads: prisma when ARCHITECH_DATA_SOURCE=prisma (the public
     site then publishes exactly the inventory the database holds), fixture
     adapter otherwise — identical output for the CI/demo build. */
  const allListings = await getListingsForServer({});
  const showcaseListingsByCity = new Map<string, Property[]>();
  for (const citySlug of showcaseCities) {
    showcaseListingsByCity.set(citySlug, await getListingsForServer({ citySlug }));
  }
  const cities = getCities().map((city) => ({
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
      featured={await getFeaturedListingsForServer(6)}
      listingCount={allListings.length}
      localityCount={getLocalities().length}
      cityCount={cities.length}
      cities={cities}
      popularSearches={popularQueries({}, 4)}
      heroPresets={heroPresets(allListings)}
      example={exampleQuery()}
      marketProjects={showcaseCities.flatMap((citySlug) => (showcaseListingsByCity.get(citySlug) ?? []).slice(0, 1)).map((listing) => ({
        name: listing.project,
        developer: listing.developer,
        locality: `${listing.locality}, ${listing.city}`,
        href: `/listing/${listing.id}/`,
        label: listing.badge,
      }))}
      marketLocalityLinks={getCities().flatMap((city) => {
        const locality = getLocalities(city.slug)[0];
        return locality ? [{ slug: locality.slug, name: locality.name, citySlug: city.slug, cityName: city.name }] : [];
      })}
    />
  );
}
