export const COLLECTIONS_KEY = "architech.collections";

/* Collections are keyed PER ACCOUNT for the same reason the shortlist is
 * (`lib/saved.ts`): one unscoped key means the next person who signs in on a
 * shared device inherits someone else's named folders — and collection names
 * and notes are first-party text, so the leak is more revealing than the
 * shortlist itself. Signed-out visitors keep guest collections; sign-in
 * folds them into the account. */

/** Storage key for one account, or guest collections when signed out. */
export function collectionsKeyFor(userId?: string | null): string {
  return userId ? `${COLLECTIONS_KEY}.u.${userId}` : `${COLLECTIONS_KEY}.guest`;
}

export type Collection = { id: string; name: string; note: string; listingIds: string[] };
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadCollections(storage: StorageLike, userId?: string | null): Collection[] {
  try {
    const raw = storage.getItem(collectionsKeyFor(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Collection => Boolean(item && typeof item.id === "string" && typeof item.name === "string" && typeof item.note === "string" && Array.isArray(item.listingIds))).map((item) => ({ ...item, listingIds: item.listingIds.filter((id): id is string => typeof id === "string") }));
  } catch {
    return [];
  }
}

export function persistCollections(storage: StorageLike, collections: Collection[], userId?: string | null) {
  try { storage.setItem(collectionsKeyFor(userId), JSON.stringify(collections)); } catch { /* quota/private mode */ }
}

/* One-time adoption of the pre-scoping global key. The old bare key held
   whoever-last-used-the-device's collections; ownership is unknowable, so
   they land on the guest bucket (never on an account) and the original key
   is cleared so a deliberately emptied store cannot resurrect itself. */
export function adoptLegacyCollections(storage: StorageLike): Collection[] {
  try {
    const raw = storage.getItem(COLLECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const legacy = Array.isArray(parsed) ? parsed.filter((item): item is Collection => Boolean(item && typeof item.id === "string" && typeof item.name === "string" && typeof item.note === "string" && Array.isArray(item.listingIds))) : [];
    if (legacy.length === 0) return [];
    const guest = loadCollections(storage, null);
    const knownIds = new Set(guest.map((c) => c.id));
    const merged = [...guest, ...legacy.filter((c) => !knownIds.has(c.id))];
    persistCollections(storage, merged, null);
    storage.setItem(COLLECTIONS_KEY, "[]");
    return merged;
  } catch {
    return [];
  }
}

/* Fold the guest collections into the account on sign-in, union-not-replace
   (deduped by collection id; ids embed a timestamp so collisions across
   devices are effectively impossible), then clear the guest bucket. */
export function mergeGuestCollections(storage: StorageLike, userId: string): Collection[] {
  if (!userId) return [];
  const guest = loadCollections(storage, null);
  const account = loadCollections(storage, userId);
  if (guest.length === 0) return account;
  const knownIds = new Set(account.map((c) => c.id));
  const merged = [...account, ...guest.filter((c) => !knownIds.has(c.id))];
  persistCollections(storage, merged, userId);
  persistCollections(storage, [], null);
  return merged;
}

export function createCollection(collections: Collection[], name: string, note = ""): Collection[] {
  const trimmed = name.trim();
  if (!trimmed) return collections;
  /* Timestamp alone collides when two creates land in the same millisecond
     (found by the merge test: identical ids made sign-in merge drop a guest
     collection). A random tail keeps ids opaque AND unique. */
  const id = `collection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
