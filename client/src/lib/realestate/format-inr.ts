/* Listing-free INR / ₹-per-sqft formatters.

   Kept in a module that does not import the inventory repository so client
   components can format numbers without pulling nationwide fixture data into
   the first-load JavaScript bundle. */
export function compactInr(value: number | null): string {
  if (value === null) return "—";
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatPsf(value: number | null): string {
  if (value === null) return "—";
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
