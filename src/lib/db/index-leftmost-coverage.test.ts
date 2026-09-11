/* LEFTMOST-COLUMN INDEX COVERAGE for single-column filters.
 *
 * WHY THIS FILE EXISTS
 *
 * A composite index can only serve a filter if the filtered column is the
 * LEFTMOST one. `@@index([cityId, lifecycle])` does nothing for a query that
 * filters on `lifecycle` alone. That is easy to get wrong precisely because
 * the schema *looks* well indexed: the moderation queue filtered on
 * `lifecycle` while Listing carried SIX indexes mentioning `lifecycle`, and
 * not one of them was usable (W1, docs/ai/sql-perf-bug-hunt-2026-09-06.md).
 * The same mistake hit ReraRecord.verificationStatus (W2).
 *
 * Correctness gates cannot see this. On fixture-sized tables a sequential
 * scan returns the same rows as an index scan, so every test stays green.
 * This guard asserts the ACCESS PATH exists instead of the rows being right.
 *
 * It reads db/schema.prisma — the real artifact — and requires that each
 * known single-column filter has SOME index (plain, unique, or composite)
 * whose FIRST column is that column. It needs no database.
 *
 * WHAT IT CANNOT DO: prove the planner picks the index, or discover new
 * single-column filters on its own. The registry below is maintained by hand;
 * the census that produced it is in the audit report, and step 2 of ARCH-19
 * re-runs it. A missing registry entry is a gap, not a false pass — so the
 * registry is asserted non-empty and every entry is checked to name a real
 * model and field, which stops it rotting silently as the schema changes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SCHEMA = readFileSync(join(process.cwd(), "db", "schema.prisma"), "utf8");

/** Single-column equality filters that run against Postgres on a real path.
    Each entry: the model, the filtered field, and the call site that proves
    it is real. Derived from the query census in
    docs/search/query-optimization-audit-2026-09-07.md §3. */
const SINGLE_COLUMN_FILTERS: ReadonlyArray<{ model: string; field: string; site: string }> = [
  { model: "Listing", field: "lifecycle", site: "getModerationQueueForServer (broker-store.ts)" },
  { model: "ReraRecord", field: "verificationStatus", site: "refreshStaleReraRecordsForServer (rera-store.ts)" },
  { model: "SavedSearchAlertOutbox", field: "status", site: "saved-search alerts-runtime.ts drain + count" },
];

/** Extract one model's body from the schema. */
function modelBody(model: string): string {
  const match = new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, "m").exec(SCHEMA);
  if (!match) throw new Error(`model ${model} not found in db/schema.prisma`);
  return match[1];
}

/** The first column of every index-like declaration on a model.
 *
 * Covers all three forms that create a usable btree index in Postgres:
 *   @@index([a, b])   @@unique([a, b])   field ... @unique
 * A single-column filter is servable if its column is FIRST in any of them.
 */
function leadingIndexedColumns(model: string): string[] {
  const body = modelBody(model);
  const leading: string[] = [];

  for (const match of body.matchAll(/@@(?:index|unique)\(\[([^\]]+)\]/g)) {
    const first = match[1].split(",")[0]?.trim();
    if (first) leading.push(first);
  }
  // Field-level @unique / @id create their own single-column index.
  for (const match of body.matchAll(/^\s*(\w+)\s+\S+.*?@(?:unique|id)\b/gm)) {
    leading.push(match[1]);
  }
  return leading;
}

describe("single-column filters have a leftmost-column index", () => {
  it("the filter registry is non-empty and names real schema fields", () => {
    // Stops the suite passing vacuously, and stops the registry drifting away
    // from the schema without anyone noticing.
    expect(SINGLE_COLUMN_FILTERS.length).toBeGreaterThan(0);
    for (const { model, field } of SINGLE_COLUMN_FILTERS) {
      expect(new RegExp(`^\\s*${field}\\s`, "m").test(modelBody(model))).toBe(true);
    }
  });

  it.each(SINGLE_COLUMN_FILTERS.map((entry) => [`${entry.model}.${entry.field}`, entry] as const))(
    "%s has an index leading with that column",
    (_label, { model, field }) => {
      /* The assertion that matters: SOME index must LEAD with this column.
         An index that merely mentions it (e.g. [cityId, lifecycle]) is not
         usable for a filter on it alone, which is the entire defect. */
      expect(leadingIndexedColumns(model)).toContain(field);
    },
  );
});

describe("the leading-column extractor itself", () => {
  it("treats a trailing column as NOT covered", () => {
    /* Guard the guard. If this ever passed, the whole file would be
       decorative: every model has plenty of indexes MENTIONING the column. */
    const listingLeading = leadingIndexedColumns("Listing");
    expect(listingLeading).toContain("lifecycle"); // the W1 index we added
    // `updatedAt` appears in Listing indexes only as a trailing column.
    expect(listingLeading).not.toContain("updatedAt");
  });

  it("recognises field-level @unique as a usable single-column index", () => {
    // City.slug is `String @unique` with no @@index — it must still count.
    expect(leadingIndexedColumns("City")).toContain("slug");
  });
});
