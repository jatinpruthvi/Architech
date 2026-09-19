import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* INDEX COVERAGE for the TechnoProperty / TechnoContactEvent predicates.
 *
 * WHY THIS FILE EXISTS
 *
 * The same reason `src/lib/search/sql-index-coverage.test.ts` exists: every
 * correctness gate in this repo asserts which ROWS a query returns, never how
 * they are found. On seeded data a sequential scan and an index scan return the
 * same rows — just slower — so "this hot predicate has no supporting index" is
 * structurally invisible to the suite. Migration 202609190002 added five
 * indexes for exactly that class of gap; this file is what keeps them aligned
 * with the queries they were derived from.
 *
 * WHAT IT CHECKS, and why each half matters:
 *   1. the schema declares the index (the queryable source of truth), and
 *   2. a migration actually creates it (schema.prisma alone would not run),
 *   3. the cited query still has the shape the index was derived from, read out
 *      of the real function body — so when a predicate changes, this fails
 *      pointing at the index to re-derive, instead of silently decaying, and
 *   4. the premise that made the OLD indexes insufficient is still true
 *      (`buildOwnerWhere` does not constrain `active`). If that ever changes,
 *      the justification in the migration needs re-deriving too.
 *
 * WHAT IT CANNOT DO: prove the planner CHOOSES these indexes. That needs
 * EXPLAIN ANALYZE against production-shaped data, and there is no live database
 * in this sandbox. It proves the strictly weaker, still-useful property that
 * the option exists and matches the emitted predicate.
 */

const schema = readFileSync("db/schema.prisma", "utf8");
const repository = readFileSync("src/lib/technoproperty/repository.ts", "utf8");

/** Every migration's SQL, concatenated: index creation is append-only here. */
function allMigrationSql(): string {
  return readdirSync("db/migrations", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      try {
        return readFileSync(join("db/migrations", entry.name, "migration.sql"), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
}
const migrations = allMigrationSql();

/** The `@@index([...])` column lists declared for one model in schema.prisma. */
function schemaIndexes(model: string): string[][] {
  const body = schema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`));
  if (!body) throw new Error(`model ${model} not found in db/schema.prisma`);
  return [...body[0].matchAll(/@@index\(\[([^\]]+)\]\)/g)].map((m) =>
    m[1].split(",").map((c) => c.trim())
  );
}

/** The body of a top-level function, by brace matching from its signature.
    The parameter list is closed first (paren-matched), then candidate braces
    are skipped while they belong to a return TYPE (`Promise<{ rows: … }>`) —
    recognised by what follows the matching brace (`>`/`{`/`;`) rather than by
    guessing at the syntax. */
function functionBody(name: string): string {
  const start = repository.search(new RegExp(`(async )?function ${name}\\(`));
  if (start < 0) throw new Error(`function ${name} not found in repository.ts`);
  let i = repository.indexOf("(", start);
  let depth = 0;
  for (; i < repository.length; i++) {
    if (repository[i] === "(") depth += 1;
    else if (repository[i] === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  let search = i;
  while (search < repository.length) {
    const open = repository.indexOf("{", search);
    depth = 0;
    let end = -1;
    for (let j = open; j < repository.length; j++) {
      if (repository[j] === "{") depth += 1;
      else if (repository[j] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end < 0) break;
    const next = repository.slice(end + 1).match(/^\s*(.)/)?.[1];
    if (next === ">" || next === "{" || next === ";") {
      search = end + 1; // a type annotation, not the body
      continue;
    }
    return repository.slice(open, end + 1);
  }
  throw new Error(`unbalanced braces reading ${name}`);
}

function createsIndexOn(table: string, columns: string[]): boolean {
  const cols = columns.map((c) => `"${c}"`).join(", ");
  return migrations.includes(`ON "${table}"(${cols})`);
}

/** Trigram indexes are hand-written (Prisma's @@index cannot express
    `USING GIN (col gin_trgm_ops)`), so the only check available is that the
    migration corpus creates one on that table+column. */
function createsTrigramIndex(table: string, column: string): boolean {
  return migrations.includes(`ON "${table}" USING GIN ("${column}" gin_trgm_ops)`);
}

/** The haystacks buildOwnerWhere/listBrokerProperties actually search. Each one
    needs its own trigram index: the arms form an OR chain, so a single
    unindexed arm forces a sequential scan of the whole predicate. */
const SEARCH_HAYSTACKS = ["address", "premiseName", "area", "ownerName", "descriptionRaw"];

/** Each entry: the index, the query it serves, and the predicate parts that
    must still be present in that query's body (or the source of its `where`). */
const REQUIRED: {
  table: string;
  columns: string[];
  serves: string;
  sources: { fn: string; mustContain: string[] }[];
}[] = [
  {
    table: "TechnoProperty",
    columns: ["orgId", "active", "firstSeenAt"],
    serves: "dashboard added-window counts/groupBys + countMatchesSince (≤20 per activities load)",
    sources: [
      { fn: "getDashboardKpis", mustContain: ["firstSeenAt", "active: true"] },
      { fn: "countMatchesSince", mustContain: ["firstSeenAt", "active: true"] },
    ],
  },
  {
    table: "TechnoProperty",
    columns: ["orgId", "active", "sourceStatus", "datePosted"],
    serves: "call-queue freshness window; activeOwner / freshUnrevealed counts; layout badge",
    sources: [
      { fn: "getCallingQueue", mustContain: ["sourceStatus", "datePosted", '"desc"'] },
      { fn: "countFreshUnrevealed", mustContain: ["sourceStatus", "datePosted"] },
    ],
  },
  {
    table: "TechnoProperty",
    columns: ["orgId", "category", "datePosted"],
    serves: "paginated owner/broker lists ordered by datePosted; match candidates",
    sources: [
      { fn: "listOwnerProperties", mustContain: ["datePosted", "count(", "skip:"] },
      { fn: "listMatchCandidates", mustContain: ["category", "datePosted"] },
    ],
  },
  {
    table: "TechnoProperty",
    columns: ["orgId", "isPremium", "datePosted"],
    serves: "Premium tab (buildOwnerWhere isPremium + datePosted ordering)",
    sources: [{ fn: "getPremium", mustContain: ["premium: \"1\""] }],
  },
  {
    table: "TechnoContactEvent",
    columns: ["orgId", "brokerUserId", "createdAt"],
    serves: "recent reveals (take 8) + call-queue follow-up log (take 1000)",
    sources: [
      { fn: "getActivities", mustContain: ["brokerUserId", "createdAt"] },
      { fn: "getCallingQueue", mustContain: ["brokerUserId", "createdAt"] },
    ],
  },
];

describe("technoproperty index coverage (202609190002)", () => {
  it.each(REQUIRED)("$table($columns) is declared in schema.prisma — $serves", ({ table, columns }) => {
    expect(schemaIndexes(table)).toContainEqual(columns);
  });

  it.each(REQUIRED)("$table($columns) is created by a migration", ({ table, columns }) => {
    expect(
      createsIndexOn(table, columns),
      `no migration creates an index on "${table}"(${columns.map((c) => `"${c}"`).join(", ")}). ` +
        "The schema declaring it is not enough — `prisma migrate deploy` runs the SQL.",
    ).toBe(true);
  });

  it.each(REQUIRED)("the query behind $table($columns) still has that shape", ({ sources }) => {
    for (const { fn, mustContain } of sources) {
      const body = functionBody(fn);
      for (const needle of mustContain) {
        expect(
          body,
          `${fn} no longer contains ${JSON.stringify(needle)} — the index derived from it ` +
            "(db/migrations/202609190002_technoproperty_query_indexes) may no longer match the " +
            "emitted predicate. Re-derive the index, then update this list.",
        ).toContain(needle);
      }
    }
  });

  /* The premise of the migration: the owner-side lists never constrain `active`,
     which is why the three `(orgId, active, …)` indexes cannot serve their
     ORDER BY datePosted. If this ever changes, the justification for indexes 3
     and 4 needs re-deriving (the old keys would become usable). */
  it("buildOwnerWhere still does not constrain active (the reason the old keys fell short)", () => {
    const body = functionBody("buildOwnerWhere");
    expect(body).toContain("orgId");
    expect(body).not.toContain("active");
  });

  it.each(SEARCH_HAYSTACKS)(
    "search haystack TechnoProperty.%s has a trigram index",
    (column) => {
      expect(
        createsTrigramIndex("TechnoProperty", column),
        `no GIN trigram index on TechnoProperty."${column}". buildOwnerWhere emits ` +
          `ILKE '%…%' against it (mode: "insensitive" → ILIKE, which no btree can serve), ` +
          "and the predicate is an OR chain, so one unindexed arm scans the whole table.",
      ).toBe(true);
    },
  );

  /* The OR arms must still be the ones the indexes were chosen for: this reads
     the real predicate list out of buildOwnerWhere, the way
     sql-index-coverage.test.ts reads predicates out of the SQL builder. */
  it("buildOwnerWhere still searches exactly the indexed haystacks", () => {
    const body = functionBody("buildOwnerWhere");
    const searched = [...body.matchAll(/\{ (\w+): \{ contains: needle, mode: "insensitive" \} \}/g)].map(
      (m) => m[1],
    );
    expect(searched.sort()).toEqual([...SEARCH_HAYSTACKS].sort());
    // ownerPhoneLast4 is searched with a plain `contains` (LIKE, no mode) and is
    // deliberately not trigram-indexed — VarChar(4) has no useful trigram.
    expect(body).toContain("ownerPhoneLast4: { contains: needle }");
  });

  /* A guard whose schema parse silently matched nothing would pass forever. */
  it("the schema parse finds the model's indexes", () => {
    expect(schemaIndexes("TechnoProperty").length).toBeGreaterThanOrEqual(9);
    expect(schemaIndexes("TechnoContactEvent").length).toBeGreaterThanOrEqual(4);
    expect(functionBody("getCallingQueue").length).toBeGreaterThan(200);
    expect(createsTrigramIndex("TechnoProperty", "address")).toBe(true);
  });
});
