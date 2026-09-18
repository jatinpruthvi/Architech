export type ListingFilter = "all" | "premium" | "rented";

export function currentListFilter(input: { premium?: string; rented?: string }): ListingFilter {
  if (input.premium === "1") return "premium";
  if (input.rented === "1") return "rented";
  return "all";
}

export function buildListUrl(
  basePath: string,
  currentSearch: string,
  changes: Record<string, string | null>,
): string {
  const params = new URLSearchParams(currentSearch);
  params.delete("page");
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function buildPaginationUrl(
  basePath: string,
  currentSearch: string,
  page: number,
  perPage: number,
): string {
  const params = new URLSearchParams(currentSearch);
  params.delete("page");
  params.delete("perPage");
  params.set("page", String(page));
  params.set("perPage", String(perPage));
  return `${basePath}?${params.toString()}`;
}

export function serializeListSearch(input: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}
