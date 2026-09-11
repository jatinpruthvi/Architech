/* A Map with a hard ceiling on live entries and a rolling expiry window.
 *
 * Why this exists (bug-hunt round 4, §6 item 1): three separate modules grew
 * their own copy of the same logic and three separate modules shipped the same
 * defect — BUG-R4-001 (metrics series), BUG-R4-002 (mutation rate-limit
 * buckets), BUG-R4-003 (login throttle buckets). Each bounded the *contents* of
 * an entry while nothing bounded the *number* of entries, and each was keyed by
 * data crossing the trust boundary (`body.name`, IP headers, `body.email`). The
 * fix was the same in every case: a ceiling plus an eviction pass. This module
 * is that fix, written once.
 *
 * Two invariants matter and are easy to get wrong:
 *
 * 1. **Eviction must not sort.** Walking the Map's own insertion order keeps
 *    eviction O(excess). Sorting by `startedAt` on every insert costs
 *    O(n log n) *per request* once the ceiling is reached, which turns the
 *    memory guard into a denial-of-service amplifier under exactly the
 *    sustained spray it exists to survive. Insertion order is a good proxy for
 *    oldest-started; the cost is that re-setting an existing key keeps its
 *    position, so a continuously-active client may sit near the front and lose
 *    at most one unthrottled window when the map is already full.
 *
 * 2. **Evict to one BELOW the ceiling.** The prune runs immediately before the
 *    caller inserts, so the post-insert size is what the ceiling bounds.
 *    Pruning to the ceiling itself lands at ceiling+1 — an off-by-one that
 *    makes the published maximum a lie.
 *
 * Pure and synchronous: no timers, no I/O. `now` is always injected so callers
 * stay deterministic and testable.
 */

export type WindowedEntry<T> = { startedAt: number; value: T };

export class BoundedWindowMap<T> {
  private readonly store = new Map<string, WindowedEntry<T>>();
  readonly maxEntries: number;
  readonly windowMs: number;

  constructor(maxEntries: number, windowMs: number) {
    if (!Number.isInteger(maxEntries) || maxEntries < 2) {
      throw new RangeError("BoundedWindowMap: maxEntries must be an integer >= 2");
    }
    if (!Number.isInteger(windowMs) || windowMs < 1) {
      throw new RangeError("BoundedWindowMap: windowMs must be an integer >= 1");
    }
    this.maxEntries = maxEntries;
    this.windowMs = windowMs;
  }

  /** Live entries. Includes expired-but-not-yet-reclaimed ones; `prune` removes those. */
  get size(): number {
    return this.store.size;
  }

  /** The live value for `key`, or `undefined` when absent or past the window. */
  peek(key: string, now: number): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (now - entry.startedAt >= this.windowMs) return undefined;
    return entry.value;
  }

  /** Insert or refresh. Prunes first, but only when the key is genuinely new —
      overwriting an expired entry reuses its slot and cannot grow the map. */
  set(key: string, value: T, now: number): void {
    if (!this.store.has(key) && this.store.size >= this.maxEntries - 1) this.prune(now);
    this.store.set(key, { startedAt: now, value });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Drop expired entries, then evict in insertion order down to `maxEntries - 1`. */
  prune(now: number): void {
    for (const [key, entry] of this.store) {
      if (now - entry.startedAt >= this.windowMs) this.store.delete(key);
    }
    const limit = this.maxEntries - 1;
    for (const key of this.store.keys()) {
      if (this.store.size <= limit) break;
      this.store.delete(key);
    }
  }
}
