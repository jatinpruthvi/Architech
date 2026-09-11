import { describe, expect, it } from "vitest";
import { facetGroupsFor } from "./search";
import type { FacetState } from "./facets";
import { buildSqlPagePlan, sqlPageDeclines, type SqlPageInput } from "./sql-page";

const GROUPS = facetGroupsFor({ intent: "buy", projection: "consumer" });

function input(overrides: Partial<SqlPageInput> = {}): SqlPageInput {
  return {
    query: "",
    category: "all",
    intent: "buy",
    state: { multi: {}, ranges: {} },
    groups: GROUPS,
    sort: "fresh",
    pageSize: 24,
    ...overrides,
  };
}

/** Every $n referenced by a statement must be a real param, and every param
    must be referenced — a numbering drift is how a predicate binds the wrong
    value, which is a recall bug. (A param MAY be referenced more than once:
    the token predicate reuses one $n across the six haystack fields, the same
    pattern sql-narrow.ts already uses.) */
function expectNumberingConsistent(statement: { sql: string; params: unknown[] }) {
  const refs = [...statement.sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
  if (!statement.params.length) {
    expect(refs).toEqual([]);
    return;
  }
  expect(Math.max(...refs)).toBe(statement.params.length);
  for (let n = 1; n <= statement.params.length; n++) expect(refs).toContain(n);
}

const findStatement = (plan: NonNullable<ReturnType<typeof buildSqlPagePlan>>, key: string) => {
  const statement = plan.statements.find((s) => s.key === key);
  expect(statement, `missing statement ${key}`).toBeDefined();
  return statement!;
};

/** The WHERE clause only — pool statements also carry FILTER (WHERE …)
    fragments in their SELECT list (the per-option counts), and page
    statements carry the ORDER BY tail; neither may confuse "is this group's
    predicate active" assertions. (" WHERE " — space-WHERE-space — never
    occurs inside " (WHERE …".) */
const whereOf = (sql: string): string => {
  const start = sql.indexOf(" WHERE ") + 7;
  const end = sql.indexOf(" ORDER BY ");
  return sql.slice(start, end === -1 ? undefined : end);
};

describe("sqlPageDeclines", () => {
  it("is empty for fully portable states", () => {
    expect(sqlPageDeclines({ multi: { bhk: ["2"], trust: ["rera"], media: ["has-photos"] }, ranges: { price: { from: 1000000, to: 2000000 } } }, GROUPS)).toEqual([]);
  });

  it("declines an ACTIVE fresh selection (label recency is not a column)", () => {
    const reasons = sqlPageDeclines({ multi: { fresh: ["7d"] }, ranges: {} }, GROUPS);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("fresh");
  });

  it("declines an ACTIVE furnishing selection (prose scrape fallback)", () => {
    const desk = facetGroupsFor({ intent: "buy", projection: "desk" });
    const reasons = sqlPageDeclines({ multi: { furnishing: ["furnished"] }, ranges: {} }, desk);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("furnishing");
  });

  it("declines whenever the furnishing group is PROJECTED, even with no selection (its counts need the prose scrape)", () => {
    const desk = facetGroupsFor({ intent: "buy", projection: "desk" });
    const reasons = sqlPageDeclines({ multi: {}, ranges: {} }, desk);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("furnishing");
  });

  it("keeps the consumer projection portable when fresh/furnishing are inactive (fresh counts are honest zeros)", () => {
    expect(sqlPageDeclines({ multi: {}, ranges: {} }, GROUPS)).toEqual([]);
  });
});

describe("buildSqlPagePlan — base predicates", () => {
  it("plans a bare active-inventory count", () => {
    const plan = buildSqlPagePlan(input());
    expect(plan).not.toBeNull();
    if (!plan) return;
    const total = findStatement(plan, "total");
    expect(total.sql).toContain('listing."lifecycle" = \'ACTIVE\'');
    expect(total.sql).toContain('COUNT(*)::int AS n');
    expect(total.sql).not.toContain("ORDER BY");
    expectNumberingConsistent(total);
    expect(total.params).toEqual([]);
  });

  it("scopes by city slug when provided", () => {
    const plan = buildSqlPagePlan(input({ citySlug: "ahmedabad" }));
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    expect(total.sql).toContain('city."slug" = $1');
    expect(total.params).toEqual(["ahmedabad"]);
  });

  it("does not invent a city predicate for nationwide searches", () => {
    const plan = buildSqlPagePlan(input());
    if (!plan) throw new Error("expected a plan");
    expect(findStatement(plan, "total").sql).not.toContain('city."slug" =');
  });
});

describe("buildSqlPagePlan — page window", () => {
  it("orders fresh by meaningfulUpdatedAt with a deterministic id tie-break", () => {
    const plan = buildSqlPagePlan(input({ sort: "fresh" }));
    if (!plan) throw new Error("expected a plan");
    const page = plan.pageStatement(0);
    expect(page.sql).toContain("ORDER BY listing.\"meaningfulUpdatedAt\" DESC, listing.\"id\" ASC");
    expect(page.sql).toContain("LIMIT $1 OFFSET $2");
    expect(page.params).toEqual([24, 0]);
  });

  it("orders price-asc / price-desc with the read order as tie-break", () => {
    for (const [sort, direction] of [
      ["price-asc", "ASC"],
      ["price-desc", "DESC"],
    ] as const) {
      const plan = buildSqlPagePlan(input({ sort }));
      if (!plan) throw new Error("expected a plan");
      const page = plan.pageStatement(48);
      expect(page.sql).toContain(`listing."priceInr" ${direction}, listing."meaningfulUpdatedAt" DESC, listing."id" ASC`);
      expect(page.params).toEqual([24, 48]);
    }
  });

  it("keeps the page WHERE identical to the total WHERE", () => {
    const plan = buildSqlPagePlan(input({ citySlug: "ahmedabad", query: "courtyard paldi", state: { multi: { bhk: ["2"] }, ranges: {} } }));
    if (!plan) throw new Error("expected a plan");
    expect(whereOf(plan.pageStatement(0).sql)).toBe(whereOf(findStatement(plan, "total").sql));
    // …and the param lists agree (page = total's params + LIMIT + OFFSET).
    const totalParams = findStatement(plan, "total").params;
    const pageParams = plan.pageStatement(24).params;
    expect(pageParams.slice(0, totalParams.length)).toEqual(totalParams);
    expect(pageParams.slice(totalParams.length)).toEqual([24, 24]);
  });
});

describe("buildSqlPagePlan — free-text query", () => {
  it("tokenizes with the shared residual tokenizer and covers the haystack fields", () => {
    const plan = buildSqlPagePlan(input({ query: "courtyard paldi" }));
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    // Two tokens, each a five-field OR sharing ONE param (the pg driver
    // binds a param once; sql-narrow.ts uses the same reuse pattern). The
    // JS haystack's project field is the title (no column exists) and its
    // developer field is the constant "Verified partner" (no column exists).
    expect(total.sql).toContain("listing.\"title\" ILIKE $1 ESCAPE '\\'");
    expect(total.sql).toContain("locality.\"name\" ILIKE $1 ESCAPE '\\'");
    expect(total.sql).toContain("city.\"name\" ILIKE $1 ESCAPE '\\'");
    expect(total.sql).toContain("'Verified partner' ILIKE $1 ESCAPE '\\'");
    expect(total.sql).toContain(") ILIKE $1 ESCAPE '\\'");
    expect(total.sql).not.toContain("projectName");
    expect(total.sql).not.toContain("developerName");
    expect(total.sql).toContain("listing.\"title\" ILIKE $2 ESCAPE '\\'");
    expect(total.params).toEqual(["%courtyard%", "%paldi%"]);
    expectNumberingConsistent(total);
  });

  it("passes Devanagari tokens through unchanged (matching is alias-side, not fold-side)", () => {
    const plan = buildSqlPagePlan(input({ query: "पालडी" }));
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    // The tokenizer keeps combining marks, so the token survives whole.
    expect(total.params).toEqual(["%पालडी%"]);
  });

  it("stops out filler words so no spurious token predicates appear", () => {
    const plan = buildSqlPagePlan(input({ query: "3 bhk flats in paldi" }));
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    // "3 bhk" is structured ($1), "in" is filler, "flats" is filler → only "paldi".
    expect(total.params).toEqual([3, "%paldi%"]);
    expect(total.sql).toContain("listing.\"bhk\" = $1");
    expect(total.sql).toContain("listing.\"title\" ILIKE $2 ESCAPE '\\'");
  });

  it("adds alias slug + name branches per token", () => {
    const plan = buildSqlPagePlan(
      input({
        query: "thaltej",
        tokenAliasMatches: new Map([["thaltej", { slugs: ["thaltej"], names: ["thaltej"] }]]),
      }),
    );
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    expect(total.sql).toContain('locality."slug" IN ($2)');
    expect(total.sql).toContain('lower(locality."name") IN ($3)');
    expect(total.params).toEqual(["%thaltej%", "thaltej", "thaltej"]);
  });

  it("adds no alias branch when the registry has no match", () => {
    const plan = buildSqlPagePlan(
      input({
        query: "thaltej",
        tokenAliasMatches: new Map([["thaltej", { slugs: [], names: [] }]]),
      }),
    );
    if (!plan) throw new Error("expected a plan");
    expect(findStatement(plan, "total").sql).not.toContain("IN (");
  });

  it("applies the structured extractions (bhk, under-limit, in-query PIN)", () => {
    const plan = buildSqlPagePlan(input({ query: "2 bhk under 1.5 cr 380001", queryPinSlugs: ["paldi"] }));
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    expect(total.sql).toContain('locality."slug" IN ($1)');
    expect(total.sql).toContain("listing.\"bhk\" = $2");
    expect(total.sql).toContain("listing.\"priceInr\" < $3");
    expect(total.params).toEqual(["paldi", 2, 15000000]);
  });

  it("applies the in-query PIN only when the runtime precomputed slugs for it", () => {
    // A PIN the registry knows nothing about still constrains: empty slugs → (1=0).
    const plan = buildSqlPagePlan(input({ query: "flats in 999999", queryPinSlugs: [] }));
    if (!plan) throw new Error("expected a plan");
    expect(findStatement(plan, "total").sql).toContain("(1=0)");
  });
});

describe("buildSqlPagePlan — PIN and bbox scoping", () => {
  it("scopes the ?pincode= param to the registry slugs", () => {
    const plan = buildSqlPagePlan(input({ pinParamSlugs: ["paldi", "bopal"] }));
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    expect(total.sql).toContain('locality."slug" IN ($1, $2)');
    expect(total.params).toEqual(["paldi", "bopal"]);
  });

  it("treats a known-shaped PIN with no registry locality as EMPTY, not unconstrained", () => {
    const plan = buildSqlPagePlan(input({ pinParamSlugs: [] }));
    if (!plan) throw new Error("expected a plan");
    expect(findStatement(plan, "total").sql).toContain("(1=0)");
  });

  it("scopes bbox to (slug, city) pairs via a row-constructor IN", () => {
    const plan = buildSqlPagePlan(input({ bboxPairs: [["paldi", "ahmedabad"], ["bopal", "ahmedabad"]] }));
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    expect(total.sql).toContain('(locality."slug", city."slug") IN (($1,$2),($3,$4))');
    expect(total.params).toEqual(["paldi", "ahmedabad", "bopal", "ahmedabad"]);
  });

  it("treats a viewport with no reviewed marker as EMPTY, not unconstrained", () => {
    const plan = buildSqlPagePlan(input({ bboxPairs: [] }));
    if (!plan) throw new Error("expected a plan");
    expect(findStatement(plan, "total").sql).toContain("(1=0)");
  });
});

describe("buildSqlPagePlan — market", () => {
  it("matches every listing for the always-true residential/buy shape", () => {
    for (const category of ["all", "residential"] as const) {
      const plan = buildSqlPagePlan(input({ category, intent: "buy" }));
      if (!plan) throw new Error("expected a plan");
      expect(findStatement(plan, "total").sql).not.toContain("(1=0)");
    }
  });

  it("constrains to nothing for categories the schema cannot express", () => {
    for (const category of ["commercial", "pg", "plot", "land", "auction"] as const) {
      const plan = buildSqlPagePlan(input({ category }));
      if (!plan) throw new Error("expected a plan");
      expect(findStatement(plan, "total").sql).toContain("(1=0)");
    }
  });

  it("constrains to nothing for rent intent (no transactionType column)", () => {
    const plan = buildSqlPagePlan(input({ intent: "rent" }));
    if (!plan) throw new Error("expected a plan");
    expect(findStatement(plan, "total").sql).toContain("(1=0)");
  });
});

describe("buildSqlPagePlan — facet predicates", () => {
  const state = (multi: SqlPageInput["state"]["multi"], ranges: SqlPageInput["state"]["ranges"] = {}): FacetState => ({ multi, ranges });

  it("ORs selected bhk options and keeps unknown ids unconstrained", () => {
    const plan = buildSqlPagePlan(input({ state: state({ bhk: ["2", "5+"] }) }));
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    expect(total.sql).toContain("listing.\"bhk\" = 2 OR listing.\"bhk\" >= 5");

    const unknown = buildSqlPagePlan(input({ state: state({ bhk: ["nonsense"] }) }));
    if (!unknown) throw new Error("expected a plan");
    expect(findStatement(unknown, "total").sql).not.toContain("bhk");
  });

  it("maps type slugs to enum codes", () => {
    const plan = buildSqlPagePlan(input({ state: state({ type: ["apartment", "villa"] }) }));
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    expect(total.sql).toContain('listing."propertyType" IN ($1, $2)');
    expect(total.params).toEqual(["APARTMENT", "VILLA"]);
  });

  it("maps status ids through the availability normaliser (aliases + default)", () => {
    const plan = buildSqlPagePlan(input({ state: state({ status: ["resale", "ready_to_move"] }) }));
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    expect(total.sql).toContain("COALESCE(CASE");
    expect(total.sql).toContain("IN ('RESALE', 'READY_TO_MOVE')");
    expect(total.sql).toContain("ELSE NULL END, 'READY_TO_MOVE')");
  });

  it("expresses trust as the exact verification enum value", () => {
    const plan = buildSqlPagePlan(input({ state: state({ trust: ["rera"] }) }));
    if (!plan) throw new Error("expected a plan");
    expect(findStatement(plan, "total").sql).toContain('listing."verification" = \'RERA_VERIFIED\'');
  });

  it("reproduces the take:1 media constants exactly (has-photos always, multi-photo never)", () => {
    const plan = buildSqlPagePlan(input({ state: state({ media: ["has-photos"] }) }));
    if (!plan) throw new Error("expected a plan");
    expect(findStatement(plan, "total").sql).toContain("(1=1)");

    const multi = buildSqlPagePlan(input({ state: state({ media: ["multi-photo"] }) }));
    if (!multi) throw new Error("expected a plan");
    expect(findStatement(multi, "total").sql).toContain("(1=0)");
  });

  it("applies range predicates with inclusive bounds", () => {
    const plan = buildSqlPagePlan(input({ state: state({}, { price: { from: 1000000, to: 5000000 } }) }));
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    expect(total.sql).toContain("listing.\"priceInr\" >= $1 AND listing.\"priceInr\" <= $2");
    expect(total.params).toEqual([1000000, 5000000]);
  });

  it("coalesces area to 0 for NULL rows (the mapper's areaNum rule)", () => {
    // area is desk-only in the projection. At runtime the desk surface is
    // declined (furnishing is projected there), so this tests the builder's
    // area expression directly with the desk groups minus furnishing.
    const desk = facetGroupsFor({ intent: "buy", projection: "desk" }).filter((group) => group.id !== "furnishing");
    const plan = buildSqlPagePlan(input({ groups: desk, state: state({}, { area: { from: 300, to: 900 } }) }));
    if (!plan) throw new Error("expected a plan");
    const total = findStatement(plan, "total");
    expect(total.sql).toContain("COALESCE(listing.\"areaSqft\", 0) >= $1 AND COALESCE(listing.\"areaSqft\", 0) <= $2");
    expect(total.params).toEqual([300, 900]);
  });

  it("resolves the place predicate from the RUNTIME-resolved slugs, not the raw selection", () => {
    const raw = buildSqlPagePlan(input({ state: state({ place: ["paldi", "ghost"] }), placeSlugs: [] }));
    if (!raw) throw new Error("expected a plan");
    // Nothing present in the pool → the JS path constrains NOTHING.
    expect(findStatement(raw, "total").sql).not.toContain('locality."slug" IN');

    const resolved = buildSqlPagePlan(input({ state: state({ place: ["paldi", "ghost"] }), placeSlugs: ["paldi"] }));
    if (!resolved) throw new Error("expected a plan");
    const total = findStatement(resolved, "total");
    expect(total.sql).toContain('locality."slug" IN ($1)');
    expect(total.params).toEqual(["paldi"]);
  });
});

describe("buildSqlPagePlan — pools", () => {
  const ACTIVE: FacetState = { multi: { bhk: ["2"], trust: ["rera"] }, ranges: {} };

  it("computes every projected group's pool with ONLY that group's predicate removed", () => {
    const plan = buildSqlPagePlan(input({ state: ACTIVE }));
    if (!plan) throw new Error("expected a plan");

    const bhkPool = findStatement(plan, plan.poolKeys["bhk"]);
    expect(whereOf(bhkPool.sql)).not.toContain("listing.\"bhk\" = 2");
    expect(whereOf(bhkPool.sql)).toContain('listing."verification" = \'RERA_VERIFIED\'');

    const trustPool = findStatement(plan, plan.poolKeys["trust"]);
    expect(whereOf(trustPool.sql)).toContain("listing.\"bhk\" = 2");
    expect(whereOf(trustPool.sql)).not.toContain("RERA_VERIFIED'");

    // Fixed groups: pool + one conditional count per option.
    expect(trustPool.sql).toContain('COUNT(*)::int AS pool');
    expect(trustPool.sql).toContain('COUNT(*) FILTER (WHERE listing."verification" = \'RERA_VERIFIED\')::int AS "c0"');
    const bhkCounts = ["COUNT(*) FILTER (WHERE listing.\"bhk\" = 2)::int AS \"c1\"", "COUNT(*) FILTER (WHERE listing.\"bhk\" >= 5)::int AS \"c4\""];
    for (const fragment of bhkCounts) expect(bhkPool.sql).toContain(fragment);
  });

  it("groups the place pool by locality with a display name", () => {
    const plan = buildSqlPagePlan(input({ state: ACTIVE }));
    if (!plan) throw new Error("expected a plan");
    const placePool = findStatement(plan, plan.poolKeys["place"]);
    expect(placePool.sql).toContain('locality."slug" AS slug, MAX(locality."name") AS name, COUNT(*)::int AS n');
    expect(placePool.sql).toContain("GROUP BY locality.\"slug\"");
    expect(placePool.sql).not.toContain('locality."slug" IN');
  });

  it("selects raw values for range pools (price as text — BigInt round-trip)", () => {
    const plan = buildSqlPagePlan(input({ state: ACTIVE }));
    if (!plan) throw new Error("expected a plan");
    expect(findStatement(plan, plan.poolKeys["price"]).sql).toContain('listing."priceInr"::text AS value');
    // area is desk-only in the projection (desk minus furnishing: the real
    // desk surface declines via sqlPageDeclines — see the area test above).
    const desk = facetGroupsFor({ intent: "buy", projection: "desk" }).filter((group) => group.id !== "furnishing");
    const deskPlan = buildSqlPagePlan(input({ groups: desk, state: ACTIVE }));
    if (!deskPlan) throw new Error("expected a plan");
    expect(findStatement(deskPlan, deskPlan.poolKeys["area"]).sql).toContain("COALESCE(listing.\"areaSqft\", 0) AS value");
  });

  it("plans the pre-facet pool without ANY facet predicate", () => {
    const plan = buildSqlPagePlan(input({ state: ACTIVE }));
    if (!plan) throw new Error("expected a plan");
    const pooledPlace = findStatement(plan, "pooledPlace");
    expect(pooledPlace.sql).toContain("GROUP BY locality.\"slug\"");
    expect(pooledPlace.sql).not.toContain("RERA_VERIFIED'");
    expect(pooledPlace.sql).not.toContain("listing.\"bhk\" = 2");
    expect(pooledPlace.sql).toContain('listing."lifecycle" = \'ACTIVE\'');
  });

  it("runs zero-option groups as honest zeros instead of omitting them", () => {
    // `fresh` counts are 0::int in prisma mode (the mapper's label never parses).
    const plan = buildSqlPagePlan(input());
    if (!plan) throw new Error("expected a plan");
    const freshPool = findStatement(plan, plan.poolKeys["fresh"]);
    expect(freshPool.sql).toContain('0::int AS "c0"');
    expect(freshPool.sql).toContain('0::int AS "c1"');
    expect(freshPool.sql).toContain('0::int AS "c2"');
  });
});

describe("buildSqlPagePlan — declines", () => {
  it("returns null for a non-portable state", () => {
    expect(buildSqlPagePlan(input({ state: { multi: { fresh: ["1d"] }, ranges: {} } }))).toBeNull();
  });

  it("returns a complete plan for the largest portable state", () => {
    const plan = buildSqlPagePlan(
      input({
        query: "2 bhk courtyard thaltej 380059",
        citySlug: "ahmedabad",
        pinParamSlugs: ["paldi"],
        queryPinSlugs: ["thaltej"],
        bboxPairs: [["paldi", "ahmedabad"]],
        tokenAliasMatches: new Map([["courtyard", { slugs: [], names: [] }], ["thaltej", { slugs: ["thaltej"], names: ["thaltej"] }]]),
        state: { multi: { bhk: ["3"], trust: ["rera"], media: ["has-photos"], type: ["apartment"], status: ["resale"], place: ["paldi"] }, ranges: { price: { from: 2000000, to: 9000000 } } },
        placeSlugs: ["paldi"],
      }),
    );
    expect(plan).not.toBeNull();
    if (!plan) return;
    for (const statement of plan.statements) expectNumberingConsistent(statement);
    expectNumberingConsistent(plan.pageStatement(24));
  });
});
