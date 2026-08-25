import { beforeEach, describe, expect, it } from "vitest";
import { createSavedSearch, deleteSavedSearch, listSavedSearches, resetSavedSearchStoreForTests, validateSavedSearchInput } from "./saved-search";
import { getSavedSearchStorageMode } from "./source";

describe("saved-search domain", () => {
  beforeEach(() => resetSavedSearchStoreForTests());

  it("validates that a query or a filter is required", () => {
    expect(validateSavedSearchInput({}).length).toBeGreaterThan(0);
    expect(validateSavedSearchInput({ query: "", filters: [] })).toContain("A saved search needs a query or at least one filter.");
    expect(validateSavedSearchInput({ query: "3 BHK in Paldi" })).toEqual([]);
    expect(validateSavedSearchInput({ filters: ["3bhk"] })).toEqual([]);
  });

  it("creates an idempotent saved search", () => {
    const first = createSavedSearch({ query: "3 BHK in Paldi", filters: ["3bhk"], sort: "price-asc", notify: true });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.savedSearch.notify).toBe(true);
    expect(first.savedSearch.filters).toEqual(["3bhk"]);

    const second = createSavedSearch({ query: "3 BHK in Paldi", filters: ["3bhk"], sort: "price-asc", notify: true });
    expect(second.ok && second.duplicate).toBe(true);
  });

  it("lists newest-first and deletes", () => {
    createSavedSearch({ query: "Paldi" });
    createSavedSearch({ query: "Thaltej" });
    expect(listSavedSearches().length).toBe(2);
    const first = listSavedSearches()[0];
    expect(deleteSavedSearch(first.id)).toBe(true);
    expect(listSavedSearches().length).toBe(1);
  });

  it("defaults storage mode to memory unless configured for prisma", () => {
    expect(getSavedSearchStorageMode(undefined)).toBe("memory");
    expect(getSavedSearchStorageMode("prisma")).toBe("prisma");
    expect(getSavedSearchStorageMode("memory")).toBe("memory");
  });
});
