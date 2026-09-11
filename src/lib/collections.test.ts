import { describe, expect, it } from "vitest";
import { adoptLegacyCollections, COLLECTIONS_KEY, createCollection, deleteCollection, loadCollections, mergeGuestCollections, persistCollections, toggleCollectionListing, updateCollection, type Collection } from "./collections";

function memStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

const storage = (value: string | null) => ({
  getItem: () => value,
  setItem: () => undefined,
});

describe("buyer collections", () => {
  it("recovers from malformed local storage", () => {
    expect(loadCollections(storage("not-json"))).toEqual([]);
    expect(loadCollections(storage(JSON.stringify([{ id: "bad" }])))).toEqual([]);
  });

  it("creates, updates, assigns, and deletes a collection deterministically", () => {
    const created = createCollection([], " Saturday visits ", " Compare light and access ");
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ name: "Saturday visits", note: "Compare light and access", listingIds: [] });
    const updated = updateCollection(created, created[0].id, { note: "Visit before noon" });
    const assigned = toggleCollectionListing(updated, created[0].id, "garden-courtyard");
    expect(assigned[0].listingIds).toEqual(["garden-courtyard"]);
    expect(toggleCollectionListing(assigned, created[0].id, "garden-courtyard")[0].listingIds).toEqual([]);
    expect(deleteCollection(assigned, created[0].id)).toEqual([]);
  });

  it("does not create a blank collection", () => {
    expect(createCollection([] as Collection[], "   ")).toEqual([]);
  });

  describe("per-account scoping (shared-device privacy)", () => {
    it("accounts and guests do not see each other's collections", () => {
      const s = memStorage();
      persistCollections(s, createCollection([], "Guest picks"), null);
      persistCollections(s, createCollection([], "Shortlist A"), "u1");
      expect(loadCollections(s, null).map((c) => c.name)).toEqual(["Guest picks"]);
      expect(loadCollections(s, "u1").map((c) => c.name)).toEqual(["Shortlist A"]);
      expect(loadCollections(s, "u2")).toEqual([]);
    });

    it("adopts the legacy global key into GUEST exactly once, never an account", () => {
      const s = memStorage({ [COLLECTIONS_KEY]: JSON.stringify(createCollection([], "Legacy")) });
      const adopted = adoptLegacyCollections(s);
      expect(adopted).toHaveLength(1);
      expect(loadCollections(s, null)).toHaveLength(1);
      expect(loadCollections(s, "u1")).toEqual([]);
      persistCollections(s, [], null);
      adoptLegacyCollections(s);
      expect(loadCollections(s, null)).toEqual([]);
    });

    it("folds guest collections into the account on sign-in and clears guest", () => {
      const s = memStorage();
      persistCollections(s, createCollection([], "Guest one"), null);
      persistCollections(s, createCollection([], "Account one"), "u1");
      const merged = mergeGuestCollections(s, "u1");
      expect(merged.map((c) => c.name)).toEqual(["Account one", "Guest one"]);
      expect(loadCollections(s, null)).toEqual([]);
      expect(loadCollections(s, "u1")).toHaveLength(2);
    });
  });
});
