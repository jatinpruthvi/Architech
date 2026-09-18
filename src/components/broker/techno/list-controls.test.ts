import { describe, expect, it } from "vitest";
import { buildListUrl, buildPaginationUrl, currentListFilter, serializeListSearch } from "./list-controls";

describe("broker list controls", () => {
  it("derives the visible status filter from supported URL parameters", () => {
    expect(currentListFilter({ premium: "1" })).toBe("premium");
    expect(currentListFilter({ rented: "1" })).toBe("rented");
    expect(currentListFilter({ premium: "0", rented: "0" })).toBe("all");
  });

  it("updates one filter without losing the user's page-size preference", () => {
    expect(
      buildListUrl(
        "/broker/owners/ResidentialRent",
        "?q=Thaltej&premium=1&page=4&perPage=50",
        { premium: null, rented: "1" },
      ),
    ).toBe("/broker/owners/ResidentialRent?q=Thaltej&perPage=50&rented=1");
  });

  it("removes the query cleanly and never leaves a dangling question mark", () => {
    expect(buildListUrl("/broker/owners/ResidentialRent", "?q=Thaltej&page=2", { q: null }))
      .toBe("/broker/owners/ResidentialRent");
  });

  it("preserves active filters while changing pages and page size", () => {
    expect(
      buildPaginationUrl(
        "/broker/owners/ResidentialRent",
        "q=Thaltej&premium=1&page=4&perPage=25",
        2,
        50,
      ),
    ).toBe("/broker/owners/ResidentialRent?q=Thaltej&premium=1&page=2&perPage=50");
  });

  it("serializes only meaningful list parameters for client pagination", () => {
    expect(serializeListSearch({ q: "Thaltej", premium: "1", rented: undefined, page: "2" }))
      .toBe("q=Thaltej&premium=1&page=2");
  });
});
