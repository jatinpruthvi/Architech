/* Search pagination policy (P1-SEO-003).
   Encodes the URL policy for search: list/detail results are paginated with a
   page-size cap, and the response carries deterministic cursor metadata so
   crawlers and clients share one contract. Facet-paginated combinations are
   never indexable (enforced in the SEO registry).

   Deterministic and server-safe. */

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 48;

export type PageRequest = {
  page?: number;
  pageSize?: number;
  total: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export function normalizePageSize(value?: number | string | null): number {
  if (typeof value === "number") return clampPageSize(value);
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? clampPageSize(parsed) : DEFAULT_PAGE_SIZE;
}

function clampPageSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(value, MAX_PAGE_SIZE);
}

export function normalizePage(value?: number | string | null): number {
  if (typeof value === "number") return Math.max(1, Math.floor(value));
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function paginate<T>(items: T[], request: Pick<PageRequest, "page" | "pageSize">, total = items.length): { items: T[]; meta: PaginationMeta } {
  const pageSize = normalizePageSize(request.pageSize);
  const page = normalizePage(request.page);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const itemsPage = items.slice(start, start + pageSize);
  return {
    items: itemsPage,
    meta: {
      page: safePage,
      pageSize,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
    },
  };
}

/** URL params for /search?q=…&page=N (cursor-free, deterministic). */
export function searchPageParams(query: string, filters: string[], sort: string, page: number): URLSearchParams {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filters.length) params.set("filters", filters.join(","));
  if (sort && sort !== "fresh") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  return params;
}
