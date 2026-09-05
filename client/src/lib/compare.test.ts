import { describe, expect, it } from "vitest";
import { adoptLegacyCompare, COMPARE_KEY, compareKeyFor, loadCompared, MAX_COMPARE, mergeGuestCompare, persistCompared } from "./compare";

function memStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    dump: () => Object.fromEntries(map),
  };
}

describe("compare tray storage", () => {
  it("distinct keys per account and guest", () => {
    const s = memStorage();
    persistCompared(s, ["a"], null);
    persistCompared(s, ["b"], "u1");
    persistCompared(s, ["c"], "u2");
    expect(loadCompared(s, null)).toEqual(["a"]);
    expect(loadCompared(s, "u1")).toEqual(["b"]);
    expect(loadCompared(s, "u2")).toEqual(["c"]);
    expect(compareKeyFor("u1")).not.toBe(compareKeyFor(null));
  });

  it("caps at MAX_COMPARE and drops non-strings and junk JSON safely", () => {
    const s = memStorage({
      [`${COMPARE_KEY}.guest`]: JSON.stringify(["1", 2, null, "3", "4", "5", "6"]),
      [`${COMPARE_KEY}.u.u1`]: "not json",
    });
    expect(loadCompared(s, null)).toEqual(["1", "3", "4", "5"].slice(0, MAX_COMPARE));
    expect(loadCompared(s, "u1")).toEqual([]);
  });

  it("adopts the legacy global key into GUEST (never an account) exactly once", () => {
    const s = memStorage({ [COMPARE_KEY]: JSON.stringify(["L1", "L2"]) });
    const adopted = adoptLegacyCompare(s);
    expect(adopted).toEqual(["L1", "L2"]);
    expect(loadCompared(s, null)).toEqual(["L1", "L2"]);
    expect(loadCompared(s, "u1")).toEqual([]);
    /* Runs once: re-running after clear resurrects nothing. */
    adoptLegacyCompare(s);
    expect(loadCompared(s, null)).toEqual(["L1", "L2"]);
    persistCompared(s, [], null);
    adoptLegacyCompare(s);
    expect(loadCompared(s, null)).toEqual([]);
  });

  it("folds the guest tray into the account on sign-in and clears it", () => {
    const s = memStorage();
    persistCompared(s, ["G1", "G2"], null);
    persistCompared(s, ["A1"], "u1");
    const merged = mergeGuestCompare(s, "u1");
    expect(merged).toEqual(["A1", "G1", "G2"]);
    expect(loadCompared(s, null)).toEqual([]);
    expect(loadCompared(s, "u1")).toEqual(["A1", "G1", "G2"]);
  });

  it("cap prefers account entries when the union overflows", () => {
    const s = memStorage();
    persistCompared(s, ["A1", "A2", "A3"], "u1");
    persistCompared(s, ["G1", "G2"], null);
    const merged = mergeGuestCompare(s, "u1");
    expect(merged.length).toBe(MAX_COMPARE);
    expect(merged.slice(0, 3)).toEqual(["A1", "A2", "A3"]);
    expect(merged).toContain("G1");
  });

  it("merge with a missing account or empty guest returns the account list untouched", () => {
    const s = memStorage();
    persistCompared(s, ["A1"], "u1");
    expect(mergeGuestCompare(s, "u1")).toEqual(["A1"]);
    expect(mergeGuestCompare(s, "")).toEqual([]);
  });
});
