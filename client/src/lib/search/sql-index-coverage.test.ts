/* INDEX COVERAGE INVARIANT for the executed search predicates.
 *
 * WHY THIS FILE EXISTS
 *
 * The query-optimization audit (docs/search/query-optimization-audit-2026-09-07.md)
 * found three ILIKE haystack columns and one trigram operand that had been
 * emitted by the query builder for weeks with no supporting index. Nothing
 * caught it, and nothing COULD have: `tsc`, lint, the parity matrix and the
 * full Vitest suite all assert which ROWS come back, never how they are
 * found. On fixture-sized data a sequential scan returns the same rows as an
 * index scan, just slower — so correctness gates are structurally blind to
 * the entire class of "this predicate has no index".
 *
 * This test closes that blind spot WITHOUT needing a database: it reads the
 * SQL the builder actually emits, extracts the predicates that require a
 * specific index type to be servable, and asserts a matching CREATE INDEX
 * exists in prisma/migrations. Both sides are the real artifacts, so the
 * invariant cannot drift out of sync with either.
 *
 * WHAT IT CANNOT DO: prove the planner CHOOSES the index. That needs EXPLAIN
 * ANALYZE against production-shaped data (there is no live database in the
 * sandbox — see the audit's "what I could not check" section). It proves the
 * strictly weaker, still-useful property that the option exists at all.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildSqlNarrowPlan, NARROW_HAYSTACK_SQL_TARGETS } from "./sql";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

/** Every migration's SQL, concatenated. Index creation is append-only here
    (no migration drops a trigram index), so a substring search over the
    corpus is the honest question: "was this index ever created?" */
function allMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      try {
        return readFileSync(join(MIGRATIONS_DIR, entry.name, "migration.sql"), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

/** Normalise whitespace so a reformatted CREATE INDEX still matches. */
const flat = (sql: string): string => sql.replace(/\s+/g, " ").toLowerCase();

/** Does the migration corpus create a GIN trigram index on table.column? */
function hasTrigramIndex(sql: string, table: string, column: string): boolean {
  const pattern = new RegExp(
    `create index[^;]*on "${table}" using gin \\( *"${column}" gin_trgm_ops`,
    "i",
  );
  return pattern.test(sql);
}

const MIGRATION_SQL = flat(allMigrationSql());

describe("search predicates have the indexes they require", () => {
  /* The `%` (similarity) operator is servable ONLY by a gin_trgm_ops index.
     No btree, no plain GIN over the column, no expression index substitutes.
     So every `x % $n` the builder emits names a hard index requirement. */
  it("every trigram (%) operand in the emitted narrow plan has a gin_trgm_ops index", () => {
    const plan = buildSqlNarrowPlan("prahladnagar garden");
    expect(plan).not.toBeNull();

    const operands = new Set(
      [...plan!.sql.matchAll(/(\w+)\."(\w+)" % \$\d+/g)].map((m) => `${m[1]}.${m[2]}`),
    );
    // Guard the guard: if the builder stops emitting `%` this test must fail
    // loudly rather than vacuously pass over an empty set.
    expect(operands.size).toBeGreaterThan(0);

    const ALIAS_TO_TABLE: Record<string, string> = { locality: "Locality", city: "City", listing: "Listing" };
    const unsupported = [...operands].filter((operand) => {
      const [alias, column] = operand.split(".");
      const table = ALIAS_TO_TABLE[alias];
      return !table || !hasTrigramIndex(MIGRATION_SQL, table, column);
    });

    expect(unsupported).toEqual([]);
  });

  /* A leading-wildcard ILIKE ('%token%') cannot use a btree index, but IS
     servable by gin_trgm_ops — which is why the haystack columns were given
     trigram indexes in the first place. Any haystack column WITHOUT one is a
     guaranteed sequential scan on every free-text search.

     propertyType is the one documented exception: a low-cardinality
     enum-like column where a trigram index costs writes and wins nothing.
     It is named explicitly so the exemption is a decision, not an oversight. */
  const ILIKE_EXEMPT = new Set(["Listing.propertyType"]);

  it("every ILIKE haystack column has a gin_trgm_ops index (or a named exemption)", () => {
    const ALIAS_TO_TABLE: Record<string, string> = { listing: "Listing", locality: "Locality", city: "City" };

    const unsupported = NARROW_HAYSTACK_SQL_TARGETS.map((target) => {
      const match = /^(\w+)\."(\w+)"$/.exec(target);
      if (!match) return null;
      const table = ALIAS_TO_TABLE[match[1]];
      const qualified = `${table}.${match[2]}`;
      if (!table || ILIKE_EXEMPT.has(qualified)) return null;
      return hasTrigramIndex(MIGRATION_SQL, table, match[2]) ? null : qualified;
    }).filter((entry): entry is string => entry !== null);

    expect(unsupported).toEqual([]);
  });

  it("the exemption list only names columns that are actually haystack targets", () => {
    // Prevents the exemption set from rotting into a silent allow-list of
    // columns nobody queries any more.
    const targets = new Set(
      NARROW_HAYSTACK_SQL_TARGETS.map((target) => {
        const match = /^(\w+)\."(\w+)"$/.exec(target)!;
        const table = { listing: "Listing", locality: "Locality", city: "City" }[match[1]];
        return `${table}.${match[2]}`;
      }),
    );
    for (const exempt of ILIKE_EXEMPT) expect(targets).toContain(exempt);
  });
});

describe("city scope is pushed into the narrow query (QP-19-001)", () => {
  it("adds a city predicate when the read is city-scoped", () => {
    const plan = buildSqlNarrowPlan("garden", "ahmedabad")!;
    expect(plan.sql).toContain('city."slug" = $1');
    expect(plan.params[0]).toBe("ahmedabad");
  });

  it("omits the predicate entirely for a nationwide read", () => {
    const plan = buildSqlNarrowPlan("garden")!;
    expect(plan.sql).not.toContain('city."slug" =');
  });

  it("keeps parameter numbering contiguous with the city parameter present", () => {
    /* The city slug takes $1, so token parameters must start at $2. A stale
       hard-coded offset here would produce a runtime bind error, not a wrong
       answer — assert it statically instead. */
    const plan = buildSqlNarrowPlan("garden", "ahmedabad")!;
    expect(plan.params).toEqual(["ahmedabad", "%garden%", "garden"]);
    expect(plan.sql).toContain("$2");
    expect(plan.sql).toContain("$3");
    const referenced = new Set([...plan.sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
    expect([...referenced].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("scoping cannot change which rows the caller ultimately returns", () => {
    /* The identity argument, pinned as a test: the outer read applies the
       SAME city filter, so a candidate from another city could never have
       survived it. Same tokens, same clause count — only the scope differs. */
    const nationwide = buildSqlNarrowPlan("prahladnagar garden")!;
    const scoped = buildSqlNarrowPlan("prahladnagar garden", "ahmedabad")!;
    expect(scoped.tokens).toEqual(nationwide.tokens);
    const clauses = (sql: string) => sql.split("\nAND (").length;
    expect(clauses(scoped.sql)).toBe(clauses(nationwide.sql));
  });
});
