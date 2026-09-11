/* LATENCY BENCH for the search pipeline (perf audit follow-up).
 *
 * WHY THIS EXISTS: the cost/perf audits fixed the structural costs (SQL page
 * query, cache headers, JS budgets). What they could not prove is WHERE the
 * remaining per-request CPU goes at the 5,000-row ceiling, and whether a
 * micro-optimization changed the number. This harness answers both:
 *
 *   1. It seeds a deterministic 5,200-row dataset into a THROWAWAY database
 *      (ARCHITECH_BENCH_DATABASE_URL — never the parity/main database), so the
 *      JS path reads exactly its MAX_UNSCOPED_LISTING_ROWS (5,000) ceiling.
 *   2. It measures p50/p95 per scenario (warm-up excluded) for the JS path —
 *      and the SQL page path for reference.
 *   3. It prints the SHA-256 of each scenario's wire JSON. That is the
 *      "same output" proof: a latency optimization is accepted only when the
 *      numbers improve AND every hash is unchanged.
 *
 *      CAVEAT the hash cannot express on its own: the wire JSON includes
 *      `queryPlan`, a DESCRIPTIVE artefact (the SQL text the plan builder
 *      would emit), not data. Changing the plan's SQL string therefore moves
 *      the hash for free-text scenarios while the RESULTS are byte-identical.
 *      That happened once deliberately, in 202609070001_search_text_config,
 *      when the FTS predicate became a two-configuration union; verified at
 *      the time by re-hashing each response with `queryPlan` removed (all five
 *      scenarios unchanged). If a hash moves, diff the response minus
 *      `queryPlan` before assuming a regression.
 *
 * Opt-in (default `pnpm test` stays green without a database):
 *
 *   ARCHITECH_BENCH_DATABASE_URL=postgresql://user:pass@host:5432/architech_bench \
 *     pnpm vitest run client/src/lib/search/latency-bench.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const benchUrl = process.env.ARCHITECH_BENCH_DATABASE_URL;
const describeLive = benchUrl ? describe : describe.skip;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: () => {}, error: () => {} } }));

import { searchListingsForServer, type ServerSearchResponse } from "./server";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import type { SearchRequest } from "./search";

/* ---------- Deterministic dataset ---------- */

const BENCH_ROWS = 5200;
const BENCH_ACTIVE = 5000; // 4 demo listings make 5,004 ACTIVE → the read caps at 5,000
const BASE_TIME = Date.UTC(2026, 6, 1); // 2026-07-01

/** Small deterministic PRNG so the dataset (and every hash) is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TITLE_TOKENS = ["Courtyard home near the garden", "Lakeview two bed with balcony", "Cedar Enclave family apartment", "Zephyr Court modern flat", "Budget starter flat by the park", "Skyline penthouse with views", "Rowhouse under the tamarind", "Garden flat, quick move"];
const AVAILABILITY = ["READY_TO_MOVE", "NEW_LAUNCH", "RESALE", "PRE_LAUNCH", "UNDER_CONSTRUCTION", "Ready to Move", "new launch", null] as const;
const VERIFICATION = ["RERA_VERIFIED", "VERIFIED_PARTNER", "SOURCE_REVIEWED", "DEMO"] as const;
const PROPERTY_TYPE = ["APARTMENT", "APARTMENT", "VILLA", "ROWHOUSE", "PENTHOUSE", "PLOT"] as const;
const FURNISHING = ["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"] as const;

type BenchRow = {
  id: string;
  stableId: string;
  city: string;
  locality: string;
  title: string;
  lifecycle: string;
  verification: string;
  propertyType: string;
  price: number;
  bhk: number;
  area: number | null;
  availability: string | null;
  detailsJson: string | null;
  sourceSummary: string | null;
  updated: string;
};

function generateRows(localitiesByCity: Record<string, string[]>): BenchRow[] {
  const rand = mulberry32(20260906);
  const rows: BenchRow[] = [];
  for (let i = 0; i < BENCH_ROWS; i++) {
    const city = i % 5 === 0 ? "mumbai" : "ahmedabad";
    const localities = localitiesByCity[city];
    // Distinct timestamps: shared minutes (i % 2000) exercise the mapper's
    // date-format cache; the +i ms jitter keeps the ordering total so the
    // 5,000-row window is deterministic.
    const updated = new Date(BASE_TIME + (i % 2000) * 60_000 + i).toISOString();
    rows.push({
      id: `bench-id-${String(i).padStart(6, "0")}`,
      stableId: `bench-${String(i).padStart(6, "0")}`,
      city,
      locality: localities[i % localities.length],
      title: TITLE_TOKENS[i % TITLE_TOKENS.length],
      lifecycle: i < BENCH_ACTIVE ? "ACTIVE" : "DRAFT",
      verification: VERIFICATION[i % 4],
      propertyType: PROPERTY_TYPE[i % 6],
      price: 4_000_000 + ((i * 7919 + Math.floor(rand() * 1000)) % 56_000_000),
      bhk: (i % 6) + 1,
      area: i % 10 === 0 ? null : 500 + ((i * 37) % 3000),
      availability: AVAILABILITY[i % 8],
      detailsJson: i % 3 === 0 ? JSON.stringify({ furnishing: FURNISHING[i % 3] }) : null,
      sourceSummary: i % 3 === 1 ? "Semi-furnished two bed in a quiet lane, near the garden." : null,
      updated,
    });
  }
  return rows;
}

const VALUES_PLACEHOLDER = "VALUES_PLACEHOLDER";
const UPSERT_SQL = `
INSERT INTO "Listing" (
  "id","stableId","slug","cityId","localityId","title","description","lifecycle","verification","propertyType",
  "priceInr","priceLabel","bhk","areaSqft","availability","detailsJson","sourceSummary",
  "meaningfulUpdatedAt","publishedAt","createdAt","updatedAt"
) VALUES ${VALUES_PLACEHOLDER}
ON CONFLICT ("stableId") DO UPDATE SET
  "lifecycle" = EXCLUDED."lifecycle", "priceInr" = EXCLUDED."priceInr", "meaningfulUpdatedAt" = EXCLUDED."meaningfulUpdatedAt"
`;

type DbClient = { $queryRawUnsafe<T>(sql: string, ...params: unknown[]): Promise<T>; $executeRawUnsafe(sql: string, ...params: unknown[]): Promise<number>; $disconnect(): Promise<void> };
const rawDb = () => getPrismaClient() as unknown as DbClient;

async function seedBenchData(): Promise<void> {
  const db = rawDb();
  const cityIds = new Map<string, string>();
  /* city:slug → locality id — slugs can repeat across cities, so the key
     must be city-qualified (the parity seed's lookup shape). */
  const localityIds = new Map<string, string>();
  const localitiesByCity: Record<string, string[]> = {};
  for (const city of ["ahmedabad", "mumbai"]) {
    const res = await db.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "City" WHERE "slug" = $1', city);
    if (!res[0]) throw new Error(`bench seed: city ${city} missing (run pnpm db:setup:sandbox first)`);
    cityIds.set(city, res[0].id);
    const locs = await db.$queryRawUnsafe<Array<{ slug: string; id: string }>>('SELECT "slug","id" FROM "Locality" WHERE "cityId" = $1 ORDER BY "slug"', res[0].id);
    if (!locs.length) throw new Error(`bench seed: no localities for ${city}`);
    localitiesByCity[city] = locs.map((l) => l.slug);
    for (const l of locs) localityIds.set(`${city}:${l.slug}`, l.id);
  }
  const rows = generateRows(localitiesByCity);
  /* 21 columns, but `description` is a SQL literal and `createdAt`/`updatedAt`
     share one parameter → 19 unique params per row. */
  const PARAMS_PER_ROW = 19;
  const BATCH = 300; // 300 rows x 19 params stays under the driver's 65,535 param cap
  for (let start = 0; start < rows.length; start += BATCH) {
    const slice = rows.slice(start, start + BATCH);
    const params: unknown[] = [];
    for (const row of slice) {
      params.push(
        row.id, row.stableId, row.stableId,
        cityIds.get(row.city)!,
        localityIds.get(`${row.city}:${row.locality}`)!,
        row.title, row.lifecycle, row.verification, row.propertyType,
        row.price, `₹${(row.price / 100_000).toFixed(0)} L`, row.bhk, row.area, row.availability,
        row.detailsJson, row.sourceSummary,
        row.updated, // meaningfulUpdatedAt
        row.updated, // publishedAt
        row.updated, // createdAt + updatedAt (shared)
      );
    }
    /* One positional parameter set PER ROW; the tuple mirrors the column list
       with the description literal and the final param reused for updatedAt. */
    const p = (k: number, j: number) => `$${k * PARAMS_PER_ROW + j + 1}`;
    const values = slice
      .map((_, k) => `(${p(k, 0)},${p(k, 1)},${p(k, 2)},${p(k, 3)},${p(k, 4)},${p(k, 5)},'Latency bench row (not real inventory)',${p(k, 6)},${p(k, 7)},${p(k, 8)},${p(k, 9)},${p(k, 10)},${p(k, 11)},${p(k, 12)},${p(k, 13)},${p(k, 14)},${p(k, 15)},${p(k, 16)},${p(k, 17)},${p(k, 18)},${p(k, 18)})`)
      .join(",");
    await db.$executeRawUnsafe(UPSERT_SQL.replace(VALUES_PLACEHOLDER, values), ...params);
  }
  /* Pin the seed script's demo-listing timestamps (it leaves them at NOW(),
     which would make the read order — and every hash — run-dependent). */
  const stamps: Array<[string, string]> = [
    ["garden-courtyard", "2026-09-04T10:00:00Z"],
    ["light-filled-home", "2026-09-03T10:00:00Z"],
    ["thaltej-dusk-house", "2026-09-02T10:00:00Z"],
    ["neem-lane-rowhouse", "2026-09-01T10:00:00Z"],
  ];
  for (const [stableId, stamp] of stamps) {
    await db.$executeRawUnsafe('UPDATE "Listing" SET "meaningfulUpdatedAt" = $2 WHERE "stableId" = $1', stableId, stamp);
  }
}

/* ---------- Scenarios ---------- */

type Scenario = { name: string; request: SearchRequest; sqlPage: boolean };

const SCENARIOS: Scenario[] = [
  // The four JS-path shapes (flag off), in cost order:
  { name: "JS  bare nationwide (5,000 rows, facet counts)", request: {}, sqlPage: false },
  { name: "JS  nationwide + free text", request: { q: "courtyard" }, sqlPage: false },
  { name: "JS  city + query + bhk + price", request: { city: "ahmedabad", q: "lake", filters: ["bhk:2", "price:5000000-20000000"] }, sqlPage: false },
  // i ≡ 5 (mod 6) ∧ i ≡ 3 (mod 8) ∧ i ≡ 0 (mod 4) is unsatisfiable → zero
  // results with a full relaxation/widening ladder.
  { name: "JS  zero-result ladder", request: { filters: ["bhk:6", "status:pre_launch", "trust:rera"] }, sqlPage: false },
  // Reference: the SQL page path on the two heaviest shapes (flag on).
  { name: "SQL bare nationwide (page path)", request: {}, sqlPage: true },
  { name: "SQL nationwide + free text (page path)", request: { q: "courtyard" }, sqlPage: true },
];

const WARMUP = 5;
const RUNS = 21;

const sha256 = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

function percentile(samples: number[], q: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

describeLive("search latency bench (live Postgres, 5,200-row dataset)", () => {
  beforeAll(async () => {
    process.env.ARCHITECH_DATA_SOURCE = "prisma";
    process.env.ARCHITECH_SEARCH_SOURCE = "prisma";
    process.env.DATABASE_URL = benchUrl!;
    await seedBenchData();
  }, 300_000);

  afterAll(async () => {
    await rawDb().$disconnect().catch(() => {});
  });

  it("measures every scenario and prints the output-identity hashes", async () => {
    const results: Array<{ name: string; p50: number; p95: number; hash: string; count: number }> = [];

    for (const scenario of SCENARIOS) {
      process.env.ARCHITECH_SEARCH_SQL_PAGE = scenario.sqlPage ? "on" : "off";
      let last: ServerSearchResponse | undefined;
      for (let i = 0; i < WARMUP; i++) last = await searchListingsForServer(scenario.request);
      expect(last, `${scenario.name}: warm-up produced a response`).toBeDefined();

      const samples: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        const startedAt = performance.now();
        last = await searchListingsForServer(scenario.request);
        samples.push(performance.now() - startedAt);
      }
      results.push({
        name: scenario.name,
        p50: percentile(samples, 0.5),
        p95: percentile(samples, 0.95),
        hash: sha256(last),
        count: last?.count ?? -1,
      });
    }
    process.env.ARCHITECH_SEARCH_SQL_PAGE = "off";

    // The zero-result scenario must actually be zero (the dataset is the
    // premise of the ladder scenario — a regression here invalidates the run).
    const ladder = results.find((r) => r.name.includes("zero-result"))!;
    expect(ladder.count, "the ladder scenario must return zero results").toBe(0);

    console.log("\n──────── search latency bench ────────");
    console.log("dataset: 5,200 rows (5,000 read at the ceiling), warm-up excluded, p50/p95 over %d runs", RUNS);
    for (const row of results) {
      console.log(`  ${row.name.padEnd(44)} p50=${row.p50.toFixed(1).padStart(8)} ms  p95=${row.p95.toFixed(1).padStart(8)} ms  wire-hash=${row.hash}`);
    }
    console.log("──────── same wire-hash before/after = same output ────────\n");
  }, 300_000);
});
