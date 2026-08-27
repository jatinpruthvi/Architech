export const COLLECTIONS_KEY = "architech.collections";

export type Collection = { id: string; name: string; note: string; listingIds: string[] };
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadCollections(storage: StorageLike): Collection[] {
  try {
    const raw = storage.getItem(COLLECTIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Collection => Boolean(item && typeof item.id === "string" && typeof item.name === "string" && typeof item.note === "string" && Array.isArray(item.listingIds))).map((item) => ({ ...item, listingIds: item.listingIds.filter((id): id is string => typeof id === "string") }));
  } catch {
    return [];
  }
}

export function persistCollections(storage: StorageLike, collections: Collection[]) {
  try { storage.setItem(COLLECTIONS_KEY, JSON.stringify(collections)); } catch { /* quota/private mode */ }
}

export function createCollection(collections: Collection[], name: string, note = ""): Collection[] {
  const trimmed = name.trim();
  if (!trimmed) return collections;
  const id = `collection-${Date.now().toString(36)}`;
  return [...collections, { id, name: trimmed, note: note.trim(), listingIds: [] }];
}

export function updateCollection(collections: Collection[], id: string, patch: Partial<Pick<Collection, "name" | "note">>): Collection[] {
  return collections.map((collection) => collection.id === id ? { ...collection, ...patch, name: patch.name?.trim() || collection.name, note: patch.note?.trim() ?? collection.note } : collection);
}

export function toggleCollectionListing(collections: Collection[], collectionId: string, listingId: string): Collection[] {
  return collections.map((collection) => {
    if (collection.id !== collectionId) return collection;
    const listingIds = collection.listingIds.includes(listingId) ? collection.listingIds.filter((id) => id !== listingId) : [...collection.listingIds, listingId];
    return { ...collection, listingIds };
  });
}

export function deleteCollection(collections: Collection[], id: string): Collection[] {
  return collections.filter((collection) => collection.id !== id);
}
