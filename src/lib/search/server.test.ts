import { describe, expect, it } from "vitest";
import { buildPostgresSearchPlan, normalizeSearchTokens } from "./sql";
import { getSearchSourceMode } from "./source";

describe("server search adapter support", () => {
  it("normalizes multilingual search tokens", () => {
    expect(normalizeSearchTokens("3 BHK पालडी under 2 cr")).toEqual(expect.arrayContaining(["bhk", "पालडी", "under", "cr"]));
  });

  it("builds PostgreSQL FTS/trigram plan metadata", () => {
    const plan = buildPostgresSearchPlan({ query: "Paldi 3 BHK", filters: ["3bhk", "rera"], sort: "price-desc", limit: 10 });
    expect(plan.usesFts).toBe(true);
    expect(plan.usesTrigram).toBe(true);
    expect(plan.where).toContain('"Listing"."bhk" >= 3');
    expect(plan.where).toContain('"Listing"."verification" = \'RERA_VERIFIED\'');
    expect(plan.orderBy).toBe('"Listing"."priceInr" DESC');
  });

  it("defaults search source to fixture unless configured", () => {
    expect(getSearchSourceMode("fixture")).toBe("fixture");
    expect(getSearchSourceMode("prisma")).toBe("prisma");
  });
});
