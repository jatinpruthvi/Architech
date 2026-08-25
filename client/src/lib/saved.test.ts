import { describe, expect, it } from "vitest";
import { loadSaved, persistSaved, toggleSaved, SAVED_KEY } from "./saved";

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
    expect(loadSaved(memoryStorage({ [SAVED_KEY]: "not json{{" }))).toEqual([]);
    expect(loadSaved(memoryStorage({ [SAVED_KEY]: '{"a":1}' }))).toEqual([]);
    expect(loadSaved(memoryStorage({ [SAVED_KEY]: '["ok",42]' }))).toEqual(["ok"]);
  });
});
