import type { Property } from "@/lib/properties";

/* Featured listings first, then the rest in source order, capped at `limit`.
 *
 * One rule, one place. The fixture adapter, the Prisma adapter and the home
 * page each used to spell this two-line rule out themselves — and the home
 * page paid for its copy with a second identical nationwide inventory read
 * (PERF-R5-001: getFeaturedListingsForServer(6) re-issued the exact query the
 * page had just made, purely to pick six of the rows).
 *
 * Pure: takes a pool that is already in memory and returns a new array (the
 * caller's array is never reordered), so it is safe from server components,
 * build paths and tests alike. */
export function orderFeaturedFirst(pool: Property[], limit: number): Property[] {
  const featured = pool.filter((property) => property.featured);
  return [...featured, ...pool.filter((property) => !property.featured)].slice(0, limit);
}
