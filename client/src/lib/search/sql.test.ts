import { describe, expect, it } from "vitest";
import { queryResidualTokens } from "@/lib/filters";
import { buildPostgresSearchPlan } from "./sql";
import { buildSqlNarrowPlan, NARROW_HAYSTACK_SQL_TARGETS } from "./sql";

describe("queryResidualTokens — the shared JS/SQL tokenizer", () => {
  it("extracts structured phrases and keeps only meaningful residuals", () => {
    expect(queryResidualTokens("3 bhk under 1.5 cr in thaltej 380059")).toEqual(["thaltej"]);
    expect(queryResidualTokens("380059")).toEqual([]);
    expect(queryResidualTokens("2bhk near thaltej homes")).toEqual(["thaltej"]);
  });

  it("keeps Devanagari tokens with their vowel signs intact", () => {
    expect(queryResidualTokens("थलतेज में फ्लैट")).toEqual(["थलतेज", "में", "फ्लैट"]);
  });

  it("drops sub-3-character residuals rather than poisson-guarding a wall of noise", () => {
    expect(queryResidualTokens("ab camde tower heights")).toEqual(["camde", "tower", "heights"]);
  });
});

describe("buildSqlNarrowPlan — executed candidate narrowing", () => {
  it("uses EXACTLY the JS tokenizer (the superset guarantee's load-bearing half)", () => {
    expect(buildSqlNarrowPlan("3 bhk under 1.5 cr in thaltej 380059")?.tokens).toEqual(queryResidualTokens("3 bhk under 1.5 cr in thaltej 380059"));
  });

  it("returns null for structured-only queries (nothing for SQL text search to add)", () => {
    expect(buildSqlNarrowPlan("380059")).toBeNull();
    expect(buildSqlNarrowPlan("")).toBeNull();
    expect(buildSqlNarrowPlan("2bhk")).toBeNull();
  });

  it("ANDs one clause per token and parameterises every user byte", () => {
    const plan = buildSqlNarrowPlan("courtyard paldi")!;
    expect(plan.params).toEqual(["%courtyard%", "courtyard", "%paldi%", "paldi"]);
    const anded = plan.sql.split("\nAND ").length - 1;
    expect(anded).toBe(2);
    /* No raw token characters may appear inside the SQL text itself. */
    expect(plan.sql).not.toContain("courtyard");
    expect(plan.sql).not.toContain("paldi");
    expect(plan.sql).toContain("websearch_to_tsquery('english', $2)");
  });

  it("covers every declared haystack column as an ILIKE alternative in every token clause", () => {
    const plan = buildSqlNarrowPlan("thaltej")!;
    for (const target of NARROW_HAYSTACK_SQL_TARGETS) {
      expect(plan.sql).toContain(`${target} ILIKE $1`);
    }
    /* The fuzz alternatives ride the raw token, not the LIKE pattern. */
    expect(plan.sql).toContain('locality."name" % $2');
    expect(plan.sql).toContain('city."name" % $2');
    expect(plan.sql).toContain('unnest(locality."aliases")');
  });

  it("only ever selects ACTIVE listings from the real table graph", () => {
    const plan = buildSqlNarrowPlan("villa")!;
    expect(plan.sql).toContain('listing."lifecycle" = \'ACTIVE\'');
    expect(plan.sql).toContain('JOIN "Locality"');
    expect(plan.sql).toContain('JOIN "City"');
    expect(plan.sql.startsWith('SELECT listing."id" FROM "Listing"')).toBe(true);
  });

  it("tokenizer output cannot carry SQL/LIKE metacharacters (injection surface check)", () => {
    for (const q of ["a'; DROP TABLE \"Listing\"; --", "100%_wildcard", "'\") OR 1=1 --", "tab\tler names"]) {
      const plan = buildSqlNarrowPlan(q);
      for (const token of plan?.tokens ?? []) {
        expect(token).toMatch(/^[\p{L}\p{M}]+$/u);
      }
    }
  });

  it("the haystack targets stay aligned with the JS matcher fields (drift alarm)", () => {
    /* The JS haystack is: locality, title, city, project, developer, subtype.
       project/developer/subtype are DERIVED from title/propertyType on prisma
       rows (see repositories/mappers fallbacks), so title/propertyType ILIKEs
       cover them. If matchesQuery ever adds a NEW raw field, add its column
       to NARROW_HAYSTACK_SQL_TARGETS or recall parity silently breaks. */
    const targets = NARROW_HAYSTACK_SQL_TARGETS.join(" ");
    expect(targets).toContain('"title"');
    expect(targets).toContain('"propertyType"');
    expect(targets).toContain('"addressLocality"');
    expect(targets).toContain('locality."name"');
    expect(targets).toContain('city."name"');
  });
});

describe("buildPostgresSearchPlan — still the description artefact", () => {
  it("keeps emitting the inspectable plan for the query-plan viewer", () => {
    const plan = buildPostgresSearchPlan({ query: "villa in thaltej", filters: ["rera"], sort: "price-asc", limit: 48 });
    expect(plan.usesFts).toBe(true);
    expect(plan.usesTrigram).toBe(true);
    expect(plan.limit).toBe(48);
    expect(plan.where.join(" ")).toContain("RERA_VERIFIED");
  });
});
