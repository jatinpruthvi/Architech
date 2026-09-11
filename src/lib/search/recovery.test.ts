import { describe, expect, it } from "vitest";
import { buildSearchRecovery } from "./recovery";

describe("no-results search recovery", () => {
  it("offers related localities when a known locality is named", () => {
    const plan = buildSearchRecovery("Paldi", []);
    expect(plan.relatedLocalities.some((item) => item.query === "Paldi")).toBe(true);
    expect(plan.relatedLocalities.length).toBeGreaterThanOrEqual(1);
  });

  it("suggests removing filters when filters are active", () => {
    const plan = buildSearchRecovery("", ["3bhk", "rera"]);
    expect(plan.suggestRemovingFilters).toBe(true);
  });

  it("provides alternative query suggestions", () => {
    const plan = buildSearchRecovery("zzzzz", []);
    expect(plan.alternativeQueries.length).toBeGreaterThan(0);
  });

  it("returns an empty-but-safe plan for a no-hit query without named locality", () => {
    const plan = buildSearchRecovery("qwerty unknown", []);
    expect(plan.relatedLocalities).toHaveLength(4); // filled from home inventory
    expect(plan.suggestRemovingFilters).toBe(true);
  });
});
