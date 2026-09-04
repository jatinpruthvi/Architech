import { describe, expect, it } from "vitest";
import { adoptLegacySaved, loadSaved, mergeGuestSaved, persistSaved, savedKeyFor, toggleSaved, SAVED_KEY } from "./saved";

function memoryStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    dump: () => store,
  };
}

describe("saved store", () => {
  it("toggles ids on and off", () => {
    expect(toggleSaved([], "a")).toEqual(["a"]);
    expect(toggleSaved(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSaved(["a", "b"], "a")).toEqual(["b"]);
  });

  it("persists and reloads", () => {
    const s = memoryStorage();
    persistSaved(s, ["x", "y"]);
    expect(loadSaved(s)).toEqual(["x", "y"]);
  });

  it("survives corrupt storage", () => {
    /* Written under the GUEST key: the bare `SAVED_KEY` is now the legacy
       key that `adoptLegacySaved` migrates from, not a key `loadSaved` reads. */
    const guestKey = savedKeyFor(null);
    expect(loadSaved(memoryStorage({ [guestKey]: "not json{{" }))).toEqual([]);
    expect(loadSaved(memoryStorage({ [guestKey]: '{"a":1}' }))).toEqual([]);
    expect(loadSaved(memoryStorage({ [guestKey]: '["ok",42]' }))).toEqual(["ok"]);
  });
});

describe("the shortlist is scoped to an account", () => {
  it("keeps two accounts' shortlists apart on one device", () => {
    /* A family laptop or an office machine. Before scoping, one global key
       meant the next person to sign in inherited the previous person's
       shortlist -- and the dashboard counted it as theirs. */
    const s = memoryStorage();
    persistSaved(s, ["flat-a"], "alice");
    persistSaved(s, ["flat-b"], "bob");
    expect(loadSaved(s, "alice")).toEqual(["flat-a"]);
    expect(loadSaved(s, "bob")).toEqual(["flat-b"]);
  });

  it("does not show an account the guest shortlist, or vice versa", () => {
    const s = memoryStorage();
    persistSaved(s, ["guest-flat"], null);
    expect(loadSaved(s, "alice")).toEqual([]);
    persistSaved(s, ["alice-flat"], "alice");
    expect(loadSaved(s, null)).toEqual(["guest-flat"]);
  });

  it("uses distinct storage keys per account", () => {
    expect(savedKeyFor("alice")).not.toBe(savedKeyFor("bob"));
    expect(savedKeyFor(null)).not.toBe(savedKeyFor("alice"));
    expect(savedKeyFor(undefined)).toBe(savedKeyFor(null));
  });

  describe("merging a guest shortlist on sign-in", () => {
    it("carries guest saves into the account and clears the guest list", () => {
      /* Someone who shortlists three flats and then registers must not lose
         them -- that is the moment they are most likely to sign up. */
      const s = memoryStorage();
      persistSaved(s, ["g1", "g2"], null);
      expect(mergeGuestSaved(s, "alice")).toEqual(["g1", "g2"]);
      expect(loadSaved(s, "alice")).toEqual(["g1", "g2"]);
      expect(loadSaved(s, null)).toEqual([]);
    });

    it("unions rather than replaces, without duplicating", () => {
      const s = memoryStorage();
      persistSaved(s, ["shared", "account-only"], "alice");
      persistSaved(s, ["shared", "guest-only"], null);
      expect(mergeGuestSaved(s, "alice")).toEqual(["shared", "account-only", "guest-only"]);
    });

    it("leaves the account list untouched when there is nothing to merge", () => {
      const s = memoryStorage();
      persistSaved(s, ["a"], "alice");
      expect(mergeGuestSaved(s, "alice")).toEqual(["a"]);
    });

    it("never merges into an empty user id", () => {
      const s = memoryStorage();
      persistSaved(s, ["g1"], null);
      expect(mergeGuestSaved(s, "")).toEqual([]);
      expect(loadSaved(s, null)).toEqual(["g1"]);
    });
  });

  describe("adopting a pre-scoping shortlist", () => {
    it("rescues a legacy list instead of silently emptying it", () => {
      /* Existing users have a list under the bare key. Ignoring it would wipe
         every shortlist on the platform the moment this shipped. */
      const s = memoryStorage({ [SAVED_KEY]: '["old-1","old-2"]' });
      expect(adoptLegacySaved(s)).toEqual(["old-1", "old-2"]);
      expect(loadSaved(s, null)).toEqual(["old-1", "old-2"]);
    });

    it("runs once and cannot resurrect a list the person has since cleared", () => {
      const s = memoryStorage({ [SAVED_KEY]: '["old-1"]' });
      adoptLegacySaved(s);
      persistSaved(s, [], null);
      expect(adoptLegacySaved(s)).toEqual([]);
      expect(loadSaved(s, null)).toEqual([]);
    });

    it("is a no-op with nothing to adopt, and survives corruption", () => {
      expect(adoptLegacySaved(memoryStorage())).toEqual([]);
      expect(adoptLegacySaved(memoryStorage({ [SAVED_KEY]: "not json{{" }))).toEqual([]);
    });
  });
});
