import { describe, expect, it } from "vitest";
import { createCollection, deleteCollection, loadCollections, toggleCollectionListing, updateCollection, type Collection } from "./collections";

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
});
