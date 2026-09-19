import { describe, expect, it } from "vitest";
import { orderFeaturedFirst } from "./featured-order";
import { getCities, getFeaturedListings, getListings, getListingsByCity } from "./index";
import { getFeaturedListingsForServer, getListingsForServer } from "./server/prisma";
import { isPrismaDataSource } from "./source";
import type { Property } from "@/lib/properties";

const property = (over: Partial<Property> = {}): Property =>
  ({
    id: "p",
    slug: "p",
    title: "Property",
    featured: false,
    ...over,
  }) as Property;

describe("orderFeaturedFirst", () => {
  it("leads with featured listings, keeps source order for the rest, and caps", () => {
    const pool = [
      property({ id: "a" }),
      property({ id: "b", featured: true }),
      property({ id: "c" }),
      property({ id: "d", featured: true }),
    ];
    expect(orderFeaturedFirst(pool, 10).map((p) => p.id)).toEqual(["b", "d", "a", "c"]);
    expect(orderFeaturedFirst(pool, 2).map((p) => p.id)).toEqual(["b", "d"]);
    expect(orderFeaturedFirst(pool, 0)).toEqual([]);
    expect(orderFeaturedFirst([], 6)).toEqual([]);
  });

  it("is pure — the caller's pool keeps its order", () => {
    const pool = [property({ id: "a" }), property({ id: "b", featured: true })];
    const before = pool.map((p) => p.id);
    orderFeaturedFirst(pool, 6);
    expect(pool.map((p) => p.id)).toEqual(before);
  });

  /* PERF-R5-001: one rule, three callers. These pins say the adapters and the
     home page all still apply the SAME ordering, so consolidating the copies
     cannot have changed which six listings a visitor sees. */
  it("is the rule the fixture adapter applies", () => {
    for (const limit of [1, 6, 50]) {
      expect(getFeaturedListings(limit)).toEqual(orderFeaturedFirst(getListings(), limit));
    }
    const city = getCities()[0].slug;
    expect(getFeaturedListings(8, city)).toEqual(orderFeaturedFirst(getListingsByCity(city), 8));
  });

  it("is the rule the Prisma adapter applies (fixture mode)", () => {
    if (isPrismaDataSource()) return; // no database in this suite
    return getListingsForServer({}).then(async (pool) => {
      expect(await getFeaturedListingsForServer(6)).toEqual(orderFeaturedFirst(pool, 6));
    });
  });

  /* The home page derives `featured` from the nationwide pool it already
     fetched instead of asking the adapter for the same read again. That is the
     whole optimisation, and it is only safe while both sides mean the same
     pool: `getListingsForServer({})` and `getListingsForServer({ citySlug:
     undefined })` (what getFeaturedListingsForServer issues) must be the same
     query. */
  it("derives exactly what the removed duplicate read returned", async () => {
    if (isPrismaDataSource()) return;
    const allListings = await getListingsForServer({});
    expect(orderFeaturedFirst(allListings, 6)).toEqual(await getFeaturedListingsForServer(6));
  });
});
