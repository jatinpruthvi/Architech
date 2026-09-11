/* Pure, testable save-store helpers (persisted to localStorage by SavedContext).
 *
 * The shortlist is keyed PER ACCOUNT.
 *
 * It used to live under one global `architech.saved` key that was never
 * scoped and never cleared on sign-out. On a shared device -- a family
 * laptop, an office machine, a broker's desk -- the next person to sign in
 * inherited the previous person's shortlist and, because the dashboard counts
 * it, was told those saved homes were theirs. A shortlist reveals budget and
 * intent, so this is a privacy problem and not only a correctness one.
 *
 * Signed-out visitors keep a guest shortlist so that saving a home does not
 * require an account. `mergeGuestSaved` folds it into the account on sign-in,
 * because a visitor who shortlists three flats and then registers should not
 * lose them. */
export const SAVED_KEY = "architech.saved";

/** Storage key for one account, or the guest list when signed out. */
export function savedKeyFor(userId?: string | null): string {
  return userId ? `${SAVED_KEY}.u.${userId}` : `${SAVED_KEY}.guest`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadSaved(storage: StorageLike, userId?: string | null): string[] {
  try {
    const raw = storage.getItem(savedKeyFor(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function toggleSaved(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function persistSaved(storage: StorageLike, list: string[], userId?: string | null) {
  try { storage.setItem(savedKeyFor(userId), JSON.stringify(list)); } catch { /* quota/private mode */ }
}

/* One-time adoption of the pre-scoping global list.
 *
 * Shortlists saved before the key was scoped sit under the bare
 * `architech.saved` key. Ignoring them would silently empty the shortlist of
 * every existing user on deploy, so the first read adopts them into the
 * guest list (we cannot know which account they belonged to, and guessing
 * would re-create the leak). From there the normal sign-in merge applies. */
export function adoptLegacySaved(storage: StorageLike): string[] {
  try {
    const raw = storage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const legacy = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    if (legacy.length === 0) return [];
    const guest = loadSaved(storage, null);
    const merged = [...guest, ...legacy.filter((id) => !guest.includes(id))];
    persistSaved(storage, merged, null);
    /* Clear the old key so this runs once and cannot resurrect a list the
       person has since deliberately emptied. */
    storage.setItem(SAVED_KEY, "[]");
    return merged;
  } catch {
    return [];
  }
}

/* Fold the guest shortlist into an account's on sign-in, then clear it.
 *
 * Union rather than replace: the person may have saved homes on this device
 * before signing in AND have a shortlist from another session. Losing either
 * would be surprising. Order is preserved, account entries first, so the list
 * does not reshuffle under them. */
export function mergeGuestSaved(storage: StorageLike, userId: string): string[] {
  if (!userId) return [];
  const guest = loadSaved(storage, null);
  const account = loadSaved(storage, userId);
  if (guest.length === 0) return account;
  const merged = [...account, ...guest.filter((id) => !account.includes(id))];
  persistSaved(storage, merged, userId);
  persistSaved(storage, [], null);
  return merged;
}
