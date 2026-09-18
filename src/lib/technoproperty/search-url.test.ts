import { describe, expect, it } from "vitest";
import { buildBrokerSearchUrl } from "./search-url";

describe("buildBrokerSearchUrl", () => {
  it("routes supported filters to the selected owner inventory", () => {
    expect(buildBrokerSearchUrl({
      category: "CommercialSell",
      query: "  SG Highway  ",
      premium: true,
    })).toBe("/broker/owners/CommercialSell?q=SG+Highway&premium=1");
  });

  it("falls back safely when the category is not supported", () => {
    expect(buildBrokerSearchUrl({ category: "unknown", query: "", premium: false }))
      .toBe("/broker/owners/ResidentialRent");
  });
});
