/* Pure, testable save-store helpers (persisted to localStorage by SavedContext). */
export const SAVED_KEY = "architech.saved";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadSaved(storage: StorageLike): string[] {
  try {
    const raw = storage.getItem(SAVED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function toggleSaved(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function persistSaved(storage: StorageLike, list: string[]) {
  try { storage.setItem(SAVED_KEY, JSON.stringify(list)); } catch { /* quota/private mode */ }
}
