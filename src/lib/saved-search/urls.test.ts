import { describe, expect, it } from "vitest";
import { savedSearchRunUrl, savedSearchesPath } from "./urls";

describe("saved-search URL builders", () => {
  it("maps a saved search to the canonical /search re-run URL", () => {
    const url = savedSearchRunUrl({ id: "s1", query: "3 BHK Paldi", filters: ["3bhk", "rera"], sort: "price-asc", notify: true, createdAt: "", updatedAt: "" });
    expect(url).toBe("/search?q=3+BHK+Paldi&filters=3bhk%2Crera&sort=price-asc");
  });

  it("omits empty query/filters and default sort", () => {
    const url = savedSearchRunUrl({ id: "s2", query: "", filters: [], sort: "fresh", notify: false, createdAt: "", updatedAt: "" });
    expect(url).toBe("/search");
  });

  it("exposes a stable saved-searches path", () => {
    expect(savedSearchesPath()).toBe("/saved-searches/");
  });
});
