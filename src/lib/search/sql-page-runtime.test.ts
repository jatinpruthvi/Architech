import { describe, expect, it, vi } from "vitest";
import { executeSqlPageSearch, sqlPageEnabled, type SqlPageRequest } from "./sql-page-runtime";
import { facetGroupsFor } from "./search";
import { parseFacetState } from "./facets";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

const prismaMock = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
  listingInclude: { city: true, locality: true, media: true },
}));
vi.mock("@/lib/repositories/server/prisma", () => prismaMock);

const GROUPS = facetGroupsFor({ intent: "buy", projection: "consumer" });

function request(overrides: Partial<SqlPageRequest> = {}): SqlPageRequest {
  return {
    query: "",
    city: "ahmedabad",
    citySlug: "ahmedabad",
    pincode: null,
    bounds: null,
    groups: GROUPS,
    state: parseFacetState("", GROUPS),
    sort: "fresh",
    page: 1,
    pageSize: 24,
    category: "all",
    intent: "buy",
    projection: "consumer",
    ...overrides,
  };
}

/** Classify a statement by its shape and return canned rows. The WHERE text
    encodes which predicates are active, so the fake can answer each pool
    differently — enough structure to catch a statement built for the wrong
    pool. */
function fakeRowsFor(sql: string): unknown[] {
  if (sql.includes("ORDER BY")) return [{ id: "row-b" }, { id: "row-a" }]; // page window
  if (sql.includes("GROUP BY locality")) {
    // pooledPlace (no facet predicate) vs pool:place (carries the active ones):
    // distinguish by whether the WHERE carries a facet predicate.
    return sql.includes("bhk")
      ? [{ slug: "paldi", name: "Paldi", n: 3 }, { slug: "bopal", name: "Bopal", n: 2 }]
      : [{ slug: "paldi", name: "Paldi", n: 5 }, { slug: "bopal", name: "Bopal", n: 4 }, { slug: "navrangpura", name: "Navrangpura", n: 1 }];
  }
  if (sql.includes('::text AS value')) return [{ value: "5000000" }, { value: "7000000" }, { value: "9000000" }];
  if (sql.includes('AS value')) return [{ value: 800 }, { value: 1200 }];
  if (sql.includes('COUNT(*)::int AS pool')) {
    // Fixed-option pools (bhk 5, type 5, status 5, media 2, trust 1, fresh 3,
    // furnishing 3). An option WITHOUT a predicate (fresh/furnishing in
    // prisma mode) is a literal 0::int in the plan — mirror that.
    const optionCount = (sql.match(/AS "c\d+"/g) ?? []).length;
    const hasFilters = sql.includes("FILTER");
    const counts: Record<string, number> = {};
    for (let i = 0; i < optionCount; i++) counts[`c${i}`] = hasFilters ? i + 1 : 0;
    return [{ pool: 12, ...counts }];
  }
  if (sql.includes('COUNT(*)::int AS n')) return [{ n: 2 }];
  return [];
}

const fakeClient = () => ({
  $queryRawUnsafe: vi.fn(async (sql: string) => fakeRowsFor(sql)),
  listing: {
    findMany: vi.fn(async () => [
      // Deliberately reversed vs the page window to prove rehydration reorders.
      { id: "row-a", stableId: "L-a", slug: "a", title: "A", description: "", priceLabel: "", priceInr: 1n, locality: { slug: "paldi", name: "Paldi" }, city: { slug: "ahmedabad", name: "Ahmedabad" } },
      { id: "row-b", stableId: "L-b", slug: "b", title: "B", description: "", priceLabel: "", priceInr: 2n, locality: { slug: "bopal", name: "Bopal" }, city: { slug: "ahmedabad", name: "Ahmedabad" } },
    ]),
  },
});

describe("sqlPageEnabled", () => {
  it("is off unless explicitly on", () => {
    expect(sqlPageEnabled({})).toBe(false);
    expect(sqlPageEnabled({ ARCHITECH_SEARCH_SQL_PAGE: "on" })).toBe(true);
    expect(sqlPageEnabled({ ARCHITECH_SEARCH_SQL_PAGE: "ON " })).toBe(true);
    expect(sqlPageEnabled({ ARCHITECH_SEARCH_SQL_PAGE: "off" })).toBe(false);
  });
});

describe("executeSqlPageSearch", () => {
  it("declines a fresh selection without touching the database", async () => {
    const client = fakeClient();
    prismaMock.getPrismaClient.mockReturnValue(client);
    const outcome = await executeSqlPageSearch(request({ state: parseFacetState("fresh:7d", GROUPS) }));
    expect(outcome).toEqual({ state: "declined" });
    expect(client.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("declines an active furnishing selection (desk projection) without touching the database", async () => {
    const desk = facetGroupsFor({ intent: "buy", projection: "desk" });
    const client = fakeClient();
    prismaMock.getPrismaClient.mockReturnValue(client);
    const outcome = await executeSqlPageSearch(request({ groups: desk, state: parseFacetState("furnishing:furnished", desk) }));
    expect(outcome).toEqual({ state: "declined" });
    expect(client.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("runs pooledPlace FIRST, resolves the place predicate, then the rest, then the page window", async () => {
    const client = fakeClient();
    prismaMock.getPrismaClient.mockReturnValue(client);
    const state = parseFacetState("bhk:2,place:paldi,place:ghost", GROUPS);
    const outcome = await executeSqlPageSearch(request({ state }));
    expect(outcome.state).toBe("executed");

    const calls = (client.$queryRawUnsafe as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((call) => call[0] as string);
    // Stage 1 is the pre-facet pool (no facet predicate).
    expect(calls[0].includes("GROUP BY locality")).toBe(true);
    expect(calls[0].includes("bhk")).toBe(false);
    // The page window runs last, with the resolved place predicate.
    expect(calls[calls.length - 1].includes("ORDER BY")).toBe(true);
    expect(calls[calls.length - 1]).toContain('locality."slug" IN');
    // "ghost" is not in the pool, so only "paldi" is resolved.
    expect(calls[calls.length - 1].includes("ghost")).toBe(false);

    const response = outcome.state === "executed" ? outcome.response : ({} as never);
    expect(response.indexPlan).toBe("postgres-fts-trigram-page");
    expect(response.count).toBe(2);
    expect(response.page).toMatchObject({ page: 1, total: 2, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    // Rehydrated in SQL window order (row-b first), regardless of read order.
    expect(response.results.map((property) => property.id)).toEqual(["L-b", "L-a"]);
    // The place facet shows the pool:place rows (bhk predicate applied).
    expect(response.facets.place.options).toEqual([
      { id: "paldi", label: "Paldi", count: 3, selected: true },
      { id: "bopal", label: "Bopal", count: 2, selected: false },
    ]);
    expect(response.facets.place.total).toBe(5);
    // bhk option counts from the conditional aggregates.
    expect(response.facets.bhk.options.map((option) => option.count)).toEqual([1, 2, 3, 4, 5]);
    expect(response.facets.bhk.total).toBe(12);
    // Range histograms from the raw pool values.
    expect(response.facets.price.histogram?.total).toBe(3);
    // The consumer projection has no area group — the desk one does.
    expect(response.facets.area).toBeUndefined();
  });

  it("declines the desk projection even with no selection (furnishing is projected there, and its counts need the prose scrape)", async () => {
    const desk = facetGroupsFor({ intent: "buy", projection: "desk" });
    const client = fakeClient();
    prismaMock.getPrismaClient.mockReturnValue(client);
    const outcome = await executeSqlPageSearch(request({ groups: desk, state: parseFacetState("", desk) }));
    expect(outcome).toEqual({ state: "declined" });
    expect(client.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("computes the desk-only area histogram from the coalesced pool values", async () => {
    // The real desk surface declines (see above); this exercises the
    // executor's area assembly with the desk groups minus furnishing.
    const desk = facetGroupsFor({ intent: "buy", projection: "desk" }).filter((group) => group.id !== "furnishing");
    const client = fakeClient();
    prismaMock.getPrismaClient.mockReturnValue(client);
    const outcome = await executeSqlPageSearch(request({ groups: desk, projection: "desk" }));
    expect(outcome.state).toBe("executed");
    const response = outcome.state === "executed" ? outcome.response : ({} as never);
    expect(response.facets.area.histogram?.total).toBe(2);
  });

  it("clamps an out-of-range page the same way paginate() does", async () => {
    const client = fakeClient();
    prismaMock.getPrismaClient.mockReturnValue(client);
    const outcome = await executeSqlPageSearch(request({ page: 9 }));
    expect(outcome.state).toBe("executed");
    const calls = (client.$queryRawUnsafe as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((call) => call[0] as string);
    const pageSql = calls.find((sql) => sql.includes("ORDER BY"))!;
    const params = (client.$queryRawUnsafe as unknown as { mock: { calls: unknown[][] } }).mock.calls.find((call) => (call[0] as string).includes("ORDER BY"))!.slice(1);
    // total = 2 → totalPages = 1 → safePage = 1 → OFFSET 0.
    expect(params[params.length - 2]).toBe(24);
    expect(params[params.length - 1]).toBe(0);
    const response = outcome.state === "executed" ? outcome.response : ({} as never);
    expect(response.page.page).toBe(1);
    expect(pageSql).toContain("LIMIT");
  });

  it("computes relaxations and widening only for a filtered zero-result page", async () => {
    const zeroClient = {
      $queryRawUnsafe: vi.fn(async (sql: string) => {
        if (sql.includes('COUNT(*)::int AS n') && !sql.includes("GROUP BY")) return [{ n: 0 }];
        return fakeRowsFor(sql);
      }),
      listing: { findMany: vi.fn(async () => []) },
    };
    prismaMock.getPrismaClient.mockReturnValue(zeroClient);
    const state = parseFacetState("bhk:2,trust:rera", GROUPS);
    const outcome = await executeSqlPageSearch(request({ state }));
    expect(outcome.state).toBe("executed");
    const response = outcome.state === "executed" ? outcome.response : ({} as never);
    expect(response.count).toBe(0);
    // Both active groups relax, in gain order (trust pool 12 > bhk pool 12? equal — stable order keeps group order).
    expect(response.relaxations.map((relaxation) => relaxation.groupId)).toEqual(["bhk", "trust"]);
    expect(response.relaxations[0].label).toBe("Remove bedrooms (1)");
    expect(response.relaxations[1].label).toBe("Remove verified only (1)");
    // Widening swaps the place selection in; candidates come from the pre-facet pool.
    expect(response.widening.length).toBeGreaterThan(0);
    expect(response.widening[0].label).toBe("Paldi");
  });

  it("returns no relaxations/widening when the empty page is unfiltered", async () => {
    const zeroClient = {
      $queryRawUnsafe: vi.fn(async (sql: string) => {
        if (sql.includes('COUNT(*)::int AS n') && !sql.includes("GROUP BY")) return [{ n: 0 }];
        return fakeRowsFor(sql);
      }),
      listing: { findMany: vi.fn(async () => []) },
    };
    prismaMock.getPrismaClient.mockReturnValue(zeroClient);
    const outcome = await executeSqlPageSearch(request({}));
    expect(outcome.state).toBe("executed");
    const response = outcome.state === "executed" ? outcome.response : ({} as never);
    expect(response.count).toBe(0);
    expect(response.relaxations).toEqual([]);
    expect(response.widening).toEqual([]);
  });

  it("reports a failure (never throws) when the database rejects a statement", async () => {
    const failing = {
      $queryRawUnsafe: vi.fn(async () => {
        throw new Error('column "nope" does not exist');
      }),
      listing: { findMany: vi.fn() },
    };
    prismaMock.getPrismaClient.mockReturnValue(failing);
    const outcome = await executeSqlPageSearch(request({}));
    expect(outcome).toEqual({ state: "failed" });
  });

  it("reports a failure when rehydration throws", async () => {
    const breaking = {
      $queryRawUnsafe: vi.fn(async (sql: string) => fakeRowsFor(sql)),
      listing: { findMany: vi.fn(async () => { throw new Error("relation \"Listing\" does not exist"); }) },
    };
    prismaMock.getPrismaClient.mockReturnValue(breaking);
    const outcome = await executeSqlPageSearch(request({}));
    expect(outcome).toEqual({ state: "failed" });
  });

  it("precomputes the PIN param and in-query PIN into registry slug sets", async () => {
    const client = fakeClient();
    prismaMock.getPrismaClient.mockReturnValue(client);
    await executeSqlPageSearch(request({ query: "flats in 380059", pincode: "380015", citySlug: undefined, city: "all" }));
    const calls = (client.$queryRawUnsafe as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const [firstSql, ...firstParams] = calls[0] as unknown[] as [string, ...unknown[]];
    // ?pincode=380015 → prahlad-nagar + satellite (one PIN, two localities);
    // the in-query PIN 380059 → thaltej. The PINs themselves are never params.
    expect(firstSql).not.toContain('city."slug" =');
    expect(firstSql).toContain('locality."slug" IN ($1, $2)');
    expect(firstSql).toContain("locality.\"slug\" IN ($3)");
    expect(firstParams).toEqual(["prahlad-nagar", "satellite", "thaltej"]);
  });

  it("constrains to (1=0) when a well-formed PIN has no registry locality", async () => {
    const client = fakeClient();
    prismaMock.getPrismaClient.mockReturnValue(client);
    await executeSqlPageSearch(request({ pincode: "999999" }));
    const [firstSql] = (client.$queryRawUnsafe as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as unknown[] as [string];
    expect(firstSql).toContain("(1=0)");
  });

  it("scopes bbox to the registry markers inside the rectangle", async () => {
    const client = fakeClient();
    prismaMock.getPrismaClient.mockReturnValue(client);
    // A box around Paldi's marker (23.011, 72.559) but not Bopal's (23.033, 72.464).
    await executeSqlPageSearch(request({ bounds: { west: 72.55, south: 23.0, east: 72.57, north: 23.02 } }));
    const [firstSql, ...firstParams] = (client.$queryRawUnsafe as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as unknown[] as [string, ...unknown[]];
    expect(firstSql).toContain('(locality."slug", city."slug") IN (');
    expect(firstParams.join(",")).toContain("paldi");
    expect(firstParams.join(",")).not.toContain("bopal");
  });
});
