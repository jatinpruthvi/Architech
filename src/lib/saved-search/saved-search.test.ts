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

  it("lists newest-first and deletes, scoped to the owner", () => {
    createSavedSearch({ userId: "u1", query: "Paldi" });
    createSavedSearch({ userId: "u1", query: "Thaltej" });
    expect(listSavedSearches("u1").length).toBe(2);
    const first = listSavedSearches("u1")[0];
    expect(deleteSavedSearch(first.id, "u1")).toBe(true);
    expect(listSavedSearches("u1").length).toBe(1);
  });

  it("never shows or deletes one account's saved search from another account", () => {
    const alice = createSavedSearch({ userId: "alice", query: "3 BHK Powai under 2.4Cr" });
    if (!alice.ok) throw new Error("create failed");
    createSavedSearch({ userId: "bob", query: "Studio Andheri" });

    /* A saved search states intent and budget. Leaking it across accounts is
       a privacy breach, and between competing brokers a commercial one. */
    expect(listSavedSearches("bob").map((s) => s.query)).toEqual(["Studio Andheri"]);
    expect(listSavedSearches("alice").map((s) => s.query)).toEqual(["3 BHK Powai under 2.4Cr"]);

    /* Bob cannot delete Alice's row even knowing its id. */
    expect(deleteSavedSearch(alice.savedSearch.id, "bob")).toBe(false);
    expect(listSavedSearches("alice")).toHaveLength(1);
  });

  it("lets two accounts save the identical search independently", () => {
    /* The dedupe key is globally unique in the database. Before it was scoped
       to the owner, the first person to save "3 BHK Paldi" owned it forever:
       everyone else's identical save returned THEIR row as a duplicate. */
    const alice = createSavedSearch({ userId: "alice", query: "3 BHK Paldi", filters: ["3bhk"] });
    const bob = createSavedSearch({ userId: "bob", query: "3 BHK Paldi", filters: ["3bhk"] });
    if (!alice.ok || !bob.ok) throw new Error("create failed");
    expect(bob.duplicate).toBe(false);
    expect(bob.savedSearch.id).not.toBe(alice.savedSearch.id);
    expect(listSavedSearches("alice")).toHaveLength(1);
    expect(listSavedSearches("bob")).toHaveLength(1);
  });

  it("returns nothing for an empty user id rather than everything", () => {
    createSavedSearch({ userId: "alice", query: "Paldi" });
    expect(listSavedSearches("")).toEqual([]);
  });

  it("defaults storage mode to memory unless configured for prisma", () => {
    expect(getSavedSearchStorageMode(undefined)).toBe("memory");
    expect(getSavedSearchStorageMode("prisma")).toBe("prisma");
    expect(getSavedSearchStorageMode("memory")).toBe("memory");
  });
});
