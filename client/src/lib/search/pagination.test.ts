import { describe, expect, it } from "vitest";
import { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE, normalizePage, normalizePageSize, paginate, searchPageParams } from "./pagination";

describe("search pagination policy", () => {
  it("normalizes page and page size with caps", () => {
    expect(normalizePageSize(999)).toBe(MAX_PAGE_SIZE);
    expect(normalizePageSize("24")).toBe(24);
    expect(normalizePageSize(null)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePage(0)).toBe(1);
    expect(normalizePage("3")).toBe(3);
    expect(normalizePage(undefined)).toBe(1);
  });

  it("paginates items and computes metadata", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const { items: page, meta } = paginate(items, { page: 2, pageSize: 24 });
    expect(page).toHaveLength(24);
    expect(meta.total).toBe(50);
    expect(meta.totalPages).toBe(3);
    expect(meta.page).toBe(2);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPreviousPage).toBe(true);
  });

  it("clamps an out-of-range page to the last page", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const { items: pageItems, meta } = paginate(items, { page: 99, pageSize: 24 });
    expect(meta.page).toBe(1);
    expect(pageItems).toHaveLength(10);
  });

  it("builds deterministic search page params", () => {
    const params = searchPageParams("3 bhk paldi", ["3bhk", "rera"], "price-asc", 2);
    expect(params.get("q")).toBe("3 bhk paldi");
    expect(params.get("filters")).toBe("3bhk,rera");
    expect(params.get("sort")).toBe("price-asc");
    expect(params.get("page")).toBe("2");
    // page 1 omits the page param
    expect(searchPageParams("", [], "fresh", 1).get("page")).toBeNull();
  });
});
