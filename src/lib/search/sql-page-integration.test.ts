/* LIVE-PARITY MATRIX for the SQL page path (cost audit P0.1 verification).
 *
 * This is the guardrail the whole rebuild depends on: the SQL page query must
 * return EXACTLY what the JS path returns, over the same database, for every
 * shape of request — not "the same result on this seed", but a standing,
 * re-runnable proof. The matrix covers every predicate the plan builder can
 * emit (tokens, aliases, Devanagari, PIN param, in-query PIN, bbox, bhk,
 * under-limit, every facet group, both ranges, market constants, place
 * resolution, zero-result ladder, declines, pagination, both sorts), plus the
 * traps the design notes call out (addressLocality is NOT a haystack field,
 * take:1 media constants, legacy availability labels, non-ACTIVE rows).
 *
 * Opt-in: it needs a real Postgres with the schema applied. Run with
 *
 *   ARCHITECH_PARITY_DATABASE_URL=postgresql://user:pass@host:5432/db \
 *     pnpm vitest run src/lib/search/sql-page-integration.test.ts
 *
 * Without the variable the file skips, so the default `pnpm test` stays
 * green in environments without a database.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dbUrl = process.env.ARCHITECH_PARITY_DATABASE_URL;
const describeLive = dbUrl ? describe : describe.skip;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: () => {}, error: () => {} } }));

import { searchListingsForServer, type ServerSearchResponse } from "./server";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import type { SearchRequest } from "./search";

/* ---------- Parity data (deterministic, idempotent) ---------- */

/* The Listing table has NO projectName/developerName columns — the mapper's
   `project` is therefore always the title and `developer` always the literal
   "Verified partner". Project-style names live in the titles below, which is
   exactly what the JS haystack sees in prisma mode. */
type Row = {
  stableId: string;
  city: string;
  locality: string;
  title: string;
  lifecycle?: string;
  verification?: string;
  propertyType?: string;
  price: number;
  bhk?: number | null;
  area?: number | null;
  availability?: string | null;
  /** Deliberately set on one row: a field the search matcher NEVER reads.
      A parity failure on the "zephyr" scenario means one path started
      matching a non-haystack column. */
  addressLocality?: string | null;
  updated: string; // ISO date, one per row — no ordering ties anywhere
};

const ROWS: Row[] = [
  { stableId: "parity-001", city: "ahmedabad", locality: "paldi", title: "Zephyr Court sunny two bed", price: 9_500_000, bhk: 2, area: 950, propertyType: "APARTMENT", availability: "READY_TO_MOVE", verification: "RERA_VERIFIED", updated: "2026-08-01T10:00:00Z" },
  { stableId: "parity-002", city: "ahmedabad", locality: "paldi", title: "Courtyard villa, old town", price: 18_500_000, bhk: 3, area: 2100, propertyType: "VILLA", availability: "Ready to Move", verification: "VERIFIED_PARTNER", updated: "2026-08-02T10:00:00Z" },
  { stableId: "parity-003", city: "ahmedabad", locality: "thaltej", title: "Cedar Enclave corner villa", price: 24_000_000, bhk: 4, area: 2400, propertyType: "VILLA", availability: "RESALE", verification: "RERA_VERIFIED", updated: "2026-08-03T10:00:00Z" },
  { stableId: "parity-004", city: "ahmedabad", locality: "thaltej", title: "Cedar Enclave new launch two bed", price: 12_000_000, bhk: 2, area: 1100, propertyType: "APARTMENT", availability: "NEW_LAUNCH", verification: "SOURCE_REVIEWED", updated: "2026-08-04T10:00:00Z" },
  { stableId: "parity-005", city: "ahmedabad", locality: "bopal", title: "Compact lake-view one bed", price: 6_000_000, bhk: 1, area: 640, propertyType: "APARTMENT", availability: "new launch", verification: "DEMO", addressLocality: "Zephyr Court", updated: "2026-08-05T10:00:00Z" },
  { stableId: "parity-006", city: "ahmedabad", locality: "bopal", title: "Lakeview Plots ready plot", price: 5_500_000, bhk: null, area: null, propertyType: "PLOT", availability: null, verification: "SOURCE_REVIEWED", updated: "2026-08-06T10:00:00Z" },
  { stableId: "parity-007", city: "ahmedabad", locality: "navrangpura", title: "Rowhouse under the tamarind", price: 9_800_000, bhk: 2, area: 1250, propertyType: "ROWHOUSE", availability: "RESALE", verification: "SOURCE_REVIEWED", updated: "2026-08-07T10:00:00Z" },
  { stableId: "parity-008", city: "ahmedabad", locality: "navrangpura", title: "Skyline Penthouse with views", price: 45_000_000, bhk: 5, area: 3200, propertyType: "PENTHOUSE", availability: "UNDER_CONSTRUCTION", verification: "RERA_VERIFIED", updated: "2026-08-08T10:00:00Z" },
  { stableId: "parity-009", city: "ahmedabad", locality: "satellite", title: "Pre-launch three bed", price: 14_000_000, bhk: 3, area: 1400, propertyType: "APARTMENT", availability: "PRE_LAUNCH", verification: "VERIFIED_PARTNER", updated: "2026-08-09T10:00:00Z" },
  { stableId: "parity-010", city: "ahmedabad", locality: "prahlad-nagar", title: "Zephyr Court family apartment", price: 11_000_000, bhk: 2, area: 1050, propertyType: "APARTMENT", availability: "READY_TO_MOVE", verification: "RERA_VERIFIED", updated: "2026-08-10T10:00:00Z" },
  { stableId: "parity-011", city: "ahmedabad", locality: "paldi", title: "Riverside Villa six bed", price: 60_000_000, bhk: 6, area: null, propertyType: "VILLA", availability: "RESALE", verification: "RERA_VERIFIED", updated: "2026-08-11T10:00:00Z" },
  { stableId: "parity-012", city: "ahmedabad", locality: "bopal", title: "Budget two bed, quick move", price: 7_000_000, bhk: 2, area: 880, propertyType: "APARTMENT", availability: "READY_TO_MOVE", verification: "SOURCE_REVIEWED", updated: "2026-08-12T10:00:00Z" },
  { stableId: "parity-013", city: "ahmedabad", locality: "thaltej", title: "Cedar Enclave renovated three bed", price: 16_000_000, bhk: 3, area: 1500, propertyType: "APARTMENT", availability: "READY_TO_MOVE", verification: "VERIFIED_PARTNER", updated: "2026-08-13T10:00:00Z" },
  { stableId: "parity-014", city: "ahmedabad", locality: "paldi", title: "Fresh two bed listing", price: 10_000_000, bhk: 2, area: 990, propertyType: "APARTMENT", availability: "NEW_LAUNCH", verification: "DEMO", updated: "2026-08-14T10:00:00Z" },
  { stableId: "parity-015", city: "ahmedabad", locality: "navrangpura", title: "Hilltop Villas four bed", price: 20_000_000, bhk: 4, area: 2600, propertyType: "VILLA", availability: "READY_TO_MOVE", verification: "RERA_VERIFIED", updated: "2026-08-15T10:00:00Z" },
  { stableId: "parity-016", city: "ahmedabad", locality: "satellite", title: "One bed starter plot", price: 5_000_000, bhk: 1, area: 1200, propertyType: "PLOT", availability: "READY_TO_MOVE", verification: "SOURCE_REVIEWED", updated: "2026-08-16T10:00:00Z" },
  { stableId: "parity-017", city: "ahmedabad", locality: "prahlad-nagar", title: "Wide five bed rowhouse", price: 28_000_000, bhk: 5, area: 3000, propertyType: "ROWHOUSE", availability: "RESALE", verification: "VERIFIED_PARTNER", updated: "2026-08-17T10:00:00Z" },
  { stableId: "parity-018", city: "ahmedabad", locality: "bopal", title: "Lakeview Plots three bed", price: 13_000_000, bhk: 3, area: 1350, propertyType: "APARTMENT", availability: "UNDER_CONSTRUCTION", verification: "RERA_VERIFIED", updated: "2026-08-18T10:00:00Z" },
  { stableId: "parity-019", city: "mumbai", locality: "bandra-west", title: "Sea Breeze sea-facing two bed", price: 25_000_000, bhk: 2, area: 1000, propertyType: "APARTMENT", availability: "READY_TO_MOVE", verification: "RERA_VERIFIED", updated: "2026-08-19T10:00:00Z" },
  { stableId: "parity-020", city: "mumbai", locality: "powai", title: "Lakeview three bed", price: 17_000_000, bhk: 3, area: 1450, propertyType: "APARTMENT", availability: "NEW_LAUNCH", verification: "VERIFIED_PARTNER", updated: "2026-08-20T10:00:00Z" },
  { stableId: "parity-021", city: "mumbai", locality: "bandra-west", title: "Sea Breeze terraced one bed", price: 9_000_000, bhk: 1, area: 850, propertyType: "ROWHOUSE", availability: "RESALE", verification: "SOURCE_REVIEWED", updated: "2026-08-21T10:00:00Z" },
  { stableId: "parity-022", city: "mumbai", locality: "powai", title: "Two bed near the lake", price: 8_000_000, bhk: 2, area: 900, propertyType: "APARTMENT", availability: "READY_TO_MOVE", verification: "DEMO", updated: "2026-08-22T10:00:00Z" },
  { stableId: "parity-023", city: "ahmedabad", locality: "paldi", title: "Draft listing, not live", price: 1_000_000, bhk: 2, area: 500, propertyType: "APARTMENT", availability: "READY_TO_MOVE", verification: "RERA_VERIFIED", lifecycle: "DRAFT", updated: "2026-08-23T10:00:00Z" },
  { stableId: "parity-024", city: "ahmedabad", locality: "thaltej", title: "Sold three bed", price: 1_500_000, bhk: 3, area: 700, propertyType: "APARTMENT", availability: "RESALE", verification: "RERA_VERIFIED", lifecycle: "SOLD", updated: "2026-08-24T10:00:00Z" },
];

/* The seed's four demo listings get fixed, distinct timestamps too — the
   "fresh" sort must be deterministic on both paths, and a Prisma read has no
   secondary tie-break. */
const SEED_STAMPS: Array<[string, string]> = [
  ["garden-courtyard", "2026-09-04T10:00:00Z"],
  ["light-filled-home", "2026-09-03T10:00:00Z"],
  ["thaltej-dusk-house", "2026-09-02T10:00:00Z"],
  ["neem-lane-rowhouse", "2026-09-01T10:00:00Z"],
];

const UPSERT_SQL = `
INSERT INTO "Listing" (
  "id","stableId","slug","cityId","localityId","title","description","lifecycle","verification","propertyType",
  "priceInr","priceLabel","bhk","areaSqft","availability","addressLocality",
  "meaningfulUpdatedAt","publishedAt","createdAt","updatedAt"
) VALUES ($1,$2,$3,$4,$5,$6,'Parity matrix demo row (not real inventory)',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)
ON CONFLICT ("stableId") DO UPDATE SET
  "title" = EXCLUDED."title",
  "lifecycle" = EXCLUDED."lifecycle",
  "verification" = EXCLUDED."verification",
  "propertyType" = EXCLUDED."propertyType",
  "priceInr" = EXCLUDED."priceInr",
  "priceLabel" = EXCLUDED."priceLabel",
  "bhk" = EXCLUDED."bhk",
  "areaSqft" = EXCLUDED."areaSqft",
  "availability" = EXCLUDED."availability",
  "addressLocality" = EXCLUDED."addressLocality",
  "meaningfulUpdatedAt" = EXCLUDED."meaningfulUpdatedAt",
  "cityId" = EXCLUDED."cityId",
  "localityId" = EXCLUDED."localityId"
`;

/* PrismaClientLike (the repo's minimal type) hides the raw methods; the
   search path itself casts the same way (see sql-page-runtime.ts). */
type DbClient = { $queryRawUnsafe<T>(sql: string, ...params: unknown[]): Promise<T>; $executeRawUnsafe(sql: string, ...params: unknown[]): Promise<number>; $disconnect(): Promise<void> };
const rawDb = () => getPrismaClient() as unknown as DbClient;

async function seedParityData(db: DbClient): Promise<void> {
  const cities = new Map<string, string>();
  for (const city of new Set(ROWS.map((row) => row.city))) {
    const res = await db.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "City" WHERE "slug" = $1', city);
    if (!res[0]) throw new Error(`parity seed: city ${city} missing (run db/seed.mjs first)`);
    cities.set(city, res[0].id);
  }
  const localities = new Map<string, string>();
  for (const row of ROWS) {
    const key = `${row.city}/${row.locality}`;
    if (!localities.has(key)) {
      const res = await db.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "Locality" WHERE "cityId" = $1 AND "slug" = $2', cities.get(row.city), row.locality);
      if (!res[0]) throw new Error(`parity seed: locality ${key} missing (run db/seed.mjs first)`);
      localities.set(key, res[0].id);
    }
  }
  for (const row of ROWS) {
    await db.$executeRawUnsafe(UPSERT_SQL,
      `parity-${row.stableId.replace("parity-", "")}-id`,
      row.stableId,
      row.stableId,
      cities.get(row.city),
      localities.get(`${row.city}/${row.locality}`),
      row.title,
      row.lifecycle ?? "ACTIVE",
      row.verification ?? "DEMO",
      row.propertyType ?? "APARTMENT",
      row.price,
      `₹${(row.price / 100_000).toFixed(0)} L`,
      row.bhk ?? null,
      row.area ?? null,
      row.availability ?? null,
      row.addressLocality ?? null,
      row.updated, // meaningfulUpdatedAt ($16)
      row.updated, // publishedAt ($17)
      row.updated // createdAt + updatedAt ($18, reused)
    );
  }
  for (const [stableId, stamp] of SEED_STAMPS) {
    await db.$executeRawUnsafe('UPDATE "Listing" SET "meaningfulUpdatedAt" = $2 WHERE "stableId" = $1', stableId, stamp);
  }
}

/* ---------- The matrix ---------- */

type Scenario = { name: string; request: SearchRequest; /** indexPlan the SQL path must report (declines fall back to the JS path's). */ plan?: string };

const SCENARIOS: Scenario[] = [
  { name: "bare city search", request: { city: "ahmedabad" } },
  { name: "bare nationwide search", request: {} },
  { name: "unknown city falls back nationwide", request: { city: "not-a-city" } },
  { name: "title token (project name is the title — no column)", request: { q: "zephyr" } },
  { name: "constant developer field (always 'Verified partner' — no column)", request: { q: "partner" } },
  { name: "locality-name token", request: { q: "thaltej" } },
  { name: "Devanagari token via the alias registry", request: { q: "थलतेज" } },
  { name: "in-query PIN", request: { q: "flats in 380007" } },
  { name: "structured bhk only", request: { q: "2 bhk" } },
  { name: "structured under-limit", request: { q: "under 1 cr" } },
  { name: "structured bhk + under-limit + token", request: { q: "2 bhk under 1.2 cr courtyard" } },
  { name: "PIN param", request: { pincode: "380009" } },
  { name: "malformed PIN is ignored", request: { pincode: "12" } },
  { name: "well-formed PIN with no registry locality", request: { pincode: "999999" } },
  { name: "bbox around Paldi only", request: { bbox: "72.55,23.0,72.57,23.025" } },
  { name: "bbox over the ocean (empty)", request: { bbox: "77.0,18.0,78.0,19.0" } },
  { name: "place multi-select", request: { filters: ["place:paldi", "place:thaltej"] } },
  { name: "place selection with a ghost locality resolves it away", request: { filters: ["place:paldi", "place:no-such-locality"] } },
  { name: "place selection that is entirely ghost constrains nothing", request: { filters: ["place:no-such-locality"] } },
  { name: "bhk multi-select incl 5+", request: { filters: ["bhk:2", "bhk:5+"] } },
  { name: "type multi-select", request: { filters: ["type:villa", "type:rowhouse"] } },
  { name: "status multi-select (codes)", request: { filters: ["status:resale", "status:ready_to_move"] } },
  { name: "status:pre_launch alone", request: { filters: ["status:pre_launch"] } },
  { name: "price range", request: { filters: ["price:9000000-16000000"] } },
  { name: "price range clamps into the control domain", request: { filters: ["price:0-999999999"] } },
  { name: "trust toggle", request: { filters: ["trust:rera"] } },
  { name: "media has-photos (always true under take:1)", request: { filters: ["media:has-photos"] } },
  { name: "media multi-photo (always false under take:1) → ladder", request: { filters: ["media:multi-photo"] } },
  { name: "zero result with relaxations + widening", request: { filters: ["status:pre_launch", "bhk:2"] } },
  { name: "zero result, single group", request: { filters: ["type:penthouse", "place:bopal"] } },
  { name: "commercial category is empty (no column yet)", request: { category: "commercial" } },
  { name: "rent intent is empty (no column yet)", request: { intent: "rent" } },
  { name: "legacy chip token via parseFilterParam", request: { filters: ["2bhk"] } },
  { name: "fresh sort, default page", request: { sort: "fresh" } },
  { name: "price ascending, windowed", request: { sort: "price-asc", limit: 10 } },
  { name: "price descending, second page", request: { sort: "price-desc", limit: 10, page: 2 } },
  /* Relevance sort. The SQL side orders by ts_rank_cd over the weighted
     searchVector; the JS side by rankByRelevance over the same weighted
     fields. These scenarios assert the two agree on the SAME database — if
     an approximation ever diverges on real rows, this fails rather than
     shipping two different answers to the same question. */
  { name: "relevance sort with query", request: { q: "courtyard", sort: "relevance" } },
  { name: "relevance sort, multi-token query", request: { q: "garden courtyard", sort: "relevance" } },
  // No query text = nothing to rank against; BOTH paths must degrade to the
  // read order rather than one of them inventing a ranking.
  { name: "relevance sort without a query degrades to fresh", request: { sort: "relevance" } },
  { name: "out-of-range page clamps", request: { page: 99 } },
  { name: "page 2 of a small result", request: { limit: 5, page: 2 } },
  { name: "query + city + PIN combined", request: { q: "courtyard", city: "ahmedabad", pincode: "380007" } },
  { name: "query + facets combined", request: { q: "cedar", filters: ["type:villa", "trust:rera"] } },
  // Desk projects the furnishing group, whose counts need the prose scrape →
  // declined at runtime; the JS path serves and is trivially equal to itself.
  { name: "declined: desk projection (furnishing group is projected)", request: { projection: "desk", filters: ["area:900-1200"] }, plan: "postgres-fts-trigram-ready" },
  { name: "declined: desk projection, no filters", request: { projection: "desk" }, plan: "postgres-fts-trigram-ready" },
  { name: "declined: fresh active (JS path serves)", request: { filters: ["fresh:7d"] }, plan: "postgres-fts-trigram-ready" },
  { name: "declined: furnishing active on desk (JS path serves)", request: { projection: "desk", filters: ["furnishing:furnished"] }, plan: "postgres-fts-trigram-ready" },
];

/* ---------- Runner ---------- */

/* `indexPlan` is a path-specific attribute (only the page path reports it),
   and `truncated` is present as an explicit `undefined` key on the JS path's
   response but absent from the page path's (the page path reports honest
   counts — it is never truncated). Both are asserted separately below, not
   by deep equality. */
const stripPlan = (response: ServerSearchResponse) => {
  // The named keys are the ones being stripped — intentionally unused.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { indexPlan, truncated, ...rest } = response;
  return rest;
};

/** The WIRE contract: app/api/search/route.ts JSON-serializes the response
    before the client sees it, and JSON drops function-valued fields — the
    facet/widening `match` closures are server-only conveniences whose
    behaviour the parity matrix pins separately (locality-slug equality on
    both paths). Parity is asserted over exactly what the client receives. */
const wire = (response: ServerSearchResponse) => JSON.parse(JSON.stringify(stripPlan(response))) as ServerSearchResponse;

describeLive("SQL page path ↔ JS path parity (live Postgres)", () => {
  beforeAll(async () => {
    process.env.ARCHITECH_DATA_SOURCE = "prisma";
    process.env.ARCHITECH_SEARCH_SOURCE = "prisma";
    process.env.DATABASE_URL = dbUrl!;
    // The SAME client the search path uses (DATABASE_URL is read at first use).
    await seedParityData(rawDb());
  }, 120_000);

  afterAll(async () => {
    await rawDb().$disconnect().catch(() => {});
  });

  for (const scenario of SCENARIOS) {
    it(`parity: ${scenario.name}`, async () => {
      delete process.env.ARCHITECH_SEARCH_SQL_PAGE;
      const jsResponse = await searchListingsForServer(scenario.request);
      process.env.ARCHITECH_SEARCH_SQL_PAGE = "on";
      const sqlResponse = await searchListingsForServer(scenario.request);

      expect(sqlResponse.indexPlan, "the SQL page path must actually run (not silently fall back)").toBe(scenario.plan ?? "postgres-fts-trigram-page");
      // The page path reports honest counts: it is never a truncated window.
      expect(sqlResponse.truncated).toBeUndefined();
      expect(wire(sqlResponse)).toEqual(wire(jsResponse));
    }, 30_000);
  }

  it("sanity: the seeded rows are visible and ACTIVE-only", async () => {
    delete process.env.ARCHITECH_SEARCH_SQL_PAGE;
    const response = await searchListingsForServer({ city: "ahmedabad" });
    const ids = response.results.map((property) => property.id).sort();
    for (const stableId of ["parity-001", "parity-011"]) expect(ids).toContain(stableId);
    for (const stableId of ["parity-023", "parity-024"]) expect(ids).not.toContain(stableId);
  }, 30_000);
});
