const SEARCH_CATEGORIES = new Set([
  "ResidentialRent",
  "ResidentialSell",
  "CommercialRent",
  "CommercialSell",
]);

export function buildBrokerSearchUrl({
  category,
  query,
  premium,
}: {
  category: string;
  query: string;
  premium: boolean;
}): string {
  const safeCategory = SEARCH_CATEGORIES.has(category) ? category : "ResidentialRent";
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (premium) params.set("premium", "1");
  const search = params.toString();
  return `/broker/owners/${safeCategory}${search ? `?${search}` : ""}`;
}
