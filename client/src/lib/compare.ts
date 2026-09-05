import type { Property } from "@/lib/repositories";

/* Comparison-page helpers (server side) AND compare-tray storage helpers
 * (client side, persisted by CompareContext). */

export const MAX_COMPARE_HOMES = 4;
export const MAX_COMPARE = MAX_COMPARE_HOMES;

export const COMPARE_ROWS: { label: string; get: (property: Property) => string }[] = [
  { label: "Price", get: (property) => property.price },
  { label: "Rate", get: (property) => property.pricePerSqft },
  { label: "Layout", get: (property) => property.meta },
  { label: "Carpet area", get: (property) => property.area },
  { label: "Locality", get: (property) => property.locality },
  { label: "Verification", get: (property) => property.badge },
  { label: "Availability", get: (property) => property.status },
  { label: "Evidence", get: (property) => property.note },
];

export function normalizeCompareIds(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : [value ?? ""];
  return values.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean).slice(0, MAX_COMPARE_HOMES);
}

export function selectComparableListings(listings: Property[], value: string | string[] | undefined): Property[] {
  const ids = new Set(normalizeCompareIds(value));
  return listings.filter((listing) => ids.has(listing.id)).slice(0, MAX_COMPARE_HOMES);
}

/* Tray storage, keyed PER ACCOUNT for the same reason `lib/saved.ts` scoped
 * the shortlist: one unscoped key on a shared device lets the next person who
 * signs in inherit the previous person's comparison set, and what you compare
 * reveals exactly what you are about to buy. Signed-out visitors keep a
 * guest tray; `mergeGuestCompare` folds it into the account on sign-in, the
 * same promise the shortlist makes. */
export const COMPARE_KEY = "architech.compare.v1";

/** Storage key for one account, or the guest tray when signed out. */
export function compareKeyFor(userId?: string | null): string {
  return userId ? `${COMPARE_KEY}.u.${userId}` : `${COMPARE_KEY}.guest`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadCompared(storage: StorageLike, userId?: string | null): string[] {
  try {
    const raw = storage.getItem(compareKeyFor(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

export function persistCompared(storage: StorageLike, ids: string[], userId?: string | null) {
  try {
    storage.setItem(compareKeyFor(userId), JSON.stringify(ids.slice(0, MAX_COMPARE)));
  } catch {
    /* Private browsing and storage quotas must not break the tray. */
  }
}

/* One-time adoption of the pre-scoping global tray, mirroring
   `adoptLegacySaved`. The old bare key held whatever the last visitor had
   compared; we cannot know whose it was, so it lands on the guest tray
   (never on an account) and the original key is cleared so this runs once. */
export function adoptLegacyCompare(storage: StorageLike): string[] {
  try {
    const raw = storage.getItem(COMPARE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const legacy = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(0, MAX_COMPARE) : [];
    if (legacy.length === 0) return [];
    const guest = loadCompared(storage, null);
    const merged = [...guest, ...legacy.filter((id) => !guest.includes(id))].slice(0, MAX_COMPARE);
    persistCompared(storage, merged, null);
    storage.setItem(COMPARE_KEY, "[]");
    return merged;
  } catch {
    return [];
  }
}

/* Fold the guest tray into the account on sign-in and clear it, union-not-
   replace, order preserved, account first. The four-slot cap still applies:
   account entries win, then guests fill any room left. */
export function mergeGuestCompare(storage: StorageLike, userId: string): string[] {
  if (!userId) return [];
  const guest = loadCompared(storage, null);
  const account = loadCompared(storage, userId);
  if (guest.length === 0) return account;
  const merged = [...account, ...guest.filter((id) => !account.includes(id))].slice(0, MAX_COMPARE);
  persistCompared(storage, merged, userId);
  persistCompared(storage, [], null);
  return merged;
}
