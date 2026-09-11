import { describe, expect, it } from "vitest";
import { BoundedWindowMap } from "./bounded-window-map";

type Bucket = { startedAt: number; count: number };

const NOW = 1_700_000_000_000;
const WINDOW = 60_000;

describe("BoundedWindowMap", () => {
  it("rejects nonsensical construction arguments", () => {
    expect(() => new BoundedWindowMap(1, WINDOW)).toThrow(RangeError);
    expect(() => new BoundedWindowMap(0, WINDOW)).toThrow(RangeError);
    expect(() => new BoundedWindowMap(1.5, WINDOW)).toThrow(RangeError);
    expect(() => new BoundedWindowMap(100, 0)).toThrow(RangeError);
    expect(() => new BoundedWindowMap(100, Number.NaN)).toThrow(RangeError);
  });

  it("stores, reads and deletes", () => {
    const map = new BoundedWindowMap<Bucket>(100, WINDOW);
    map.set("a", { startedAt: NOW, count: 1 }, NOW);
    expect(map.peek("a", NOW)).toEqual({ startedAt: NOW, count: 1 });
    expect(map.peek("missing", NOW)).toBeUndefined();
    map.delete("a");
    expect(map.peek("a", NOW)).toBeUndefined();
    expect(map.size).toBe(0);
  });

  it("treats an entry past the window as absent without dropping the slot", () => {
    const map = new BoundedWindowMap<Bucket>(100, WINDOW);
    map.set("a", { startedAt: NOW, count: 1 }, NOW);
    expect(map.peek("a", NOW + WINDOW - 1)).toBeDefined();
    expect(map.peek("a", NOW + WINDOW)).toBeUndefined();
    // Still resident until pruned — overwriting it must not grow the map.
    expect(map.size).toBe(1);
  });

  /* The off-by-one this helper exists to prevent (BUG-R4-002 follow-up):
     prune-to-ceiling then insert lands at ceiling+1, making the published
     maximum false. The bound must hold on the size AFTER the insert.
     Steady state is exactly maxEntries: prune evicts to maxEntries-1, the
     insert that follows brings it back to maxEntries, never past it. */
  it("never exceeds maxEntries, measured after the insert", () => {
    const max = 50;
    const map = new BoundedWindowMap<Bucket>(max, WINDOW);
    for (let i = 0; i < 5_000; i += 1) {
      map.set(`key-${i}`, { startedAt: NOW + i, count: 1 }, NOW + i);
      expect(map.size).toBeLessThanOrEqual(max);
    }
    expect(map.size).toBe(max);
  });

  it("reclaims expired entries before evicting live ones", () => {
    const map = new BoundedWindowMap<Bucket>(10, WINDOW);
    // 9 stale entries, then one live one that must survive.
    for (let i = 0; i < 9; i += 1) map.set(`stale-${i}`, { startedAt: NOW, count: 1 }, NOW);
    const later = NOW + WINDOW + 1;
    map.set("live", { startedAt: later, count: 7 }, later);
    map.prune(later);
    expect(map.size).toBe(1);
    expect(map.peek("live", later)).toEqual({ startedAt: later, count: 7 });
  });

  /* Invariant 1: eviction is insertion-order, not sort-based. A sort on every
     insert would be O(n log n) per request once full — the memory guard
     becoming its own DoS amplifier. With maxEntries 3, inserting a,b,c,d
     evicts exactly one entry on the fourth insert. Decreasing startedAt values
     mean a sort-based eviction would drop "c" (smallest startedAt) while
     insertion-order eviction drops "a". */
  it("evicts by insertion order, not by startedAt", () => {
    const map = new BoundedWindowMap<Bucket>(3, WINDOW * 1000);
    map.set("a", { startedAt: NOW + 300, count: 1 }, NOW);
    map.set("b", { startedAt: NOW + 200, count: 1 }, NOW);
    map.set("c", { startedAt: NOW + 100, count: 1 }, NOW);
    map.set("d", { startedAt: NOW + 400, count: 1 }, NOW);
    expect(map.size).toBe(3);
    expect(map.peek("a", NOW)).toBeUndefined();
    expect(map.peek("b", NOW)).toBeDefined();
    expect(map.peek("c", NOW)).toBeDefined();
    expect(map.peek("d", NOW)).toBeDefined();
  });

  it("returns the live object so callers can mutate counters in place", () => {
    const map = new BoundedWindowMap<Bucket>(100, WINDOW);
    map.set("a", { startedAt: NOW, count: 1 }, NOW);
    const bucket = map.peek("a", NOW);
    expect(bucket).toBeDefined();
    bucket!.count += 1;
    expect(map.peek("a", NOW)?.count).toBe(2);
  });

  it("clear empties the map", () => {
    const map = new BoundedWindowMap<Bucket>(100, WINDOW);
    map.set("a", { startedAt: NOW, count: 1 }, NOW);
    map.set("b", { startedAt: NOW, count: 1 }, NOW);
    map.clear();
    expect(map.size).toBe(0);
  });
});
