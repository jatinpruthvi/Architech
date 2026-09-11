import { describe, expect, it } from "vitest";
import { adoptLegacySaved, loadSaved, mergeGuestSaved, persistSaved, SAVED_KEY } from "@/lib/saved";

/* Replays the exact browser sequence SavedContext performs, against a real
   Storage-shaped object: legacy list present -> visitor browses signed out ->
   signs in as Alice -> signs out -> Bob signs in on the same device. */
function storage() {
  const s: Record<string, string> = {};
  return { getItem: (k: string) => (k in s ? s[k] : null), setItem: (k: string, v: string) => { s[k] = v; }, dump: () => s };
}

describe("shared-device journey", () => {
  it("migrates a legacy list, follows the signed-in account, and never hands it to the next person", () => {
    const s = storage();
    s.setItem(SAVED_KEY, JSON.stringify(["legacy-flat"]));

    // Mount, signed out: legacy list is adopted as the guest list.
    adoptLegacySaved(s);
    expect(loadSaved(s, null)).toEqual(["legacy-flat"]);

    // Visitor saves one more, then signs in as Alice.
    persistSaved(s, ["legacy-flat", "guest-flat"], null);
    expect(mergeGuestSaved(s, "alice")).toEqual(["legacy-flat", "guest-flat"]);

    // Alice saves a third.
    persistSaved(s, ["legacy-flat", "guest-flat", "alice-flat"], "alice");

    // Alice signs out; Bob signs in on the same device.
    adoptLegacySaved(s);                    // runs again on mount, must be inert
    expect(mergeGuestSaved(s, "bob")).toEqual([]);
    expect(loadSaved(s, "bob")).toEqual([]);

    // Alice's shortlist is intact and still hers.
    expect(loadSaved(s, "alice")).toEqual(["legacy-flat", "guest-flat", "alice-flat"]);
  });
});
