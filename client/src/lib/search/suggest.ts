/* Search suggestion module.

   Deterministic, server-safe and side-effect free so it can be shared by the
   client hero search, the results header, and the server suggestion endpoint.

   Everything here is *derived from the registry and live inventory* rather than
   written down by hand. The previous version shipped a hardcoded
   `POPULAR_QUERIES` list ("3 BHK in Paldi", "New launches in Bopal") and a
   `String.includes` matcher, which meant the suggestions were wrong in eleven
   of the twelve cities and ranked a mid-word substring hit as highly as an
   exact one. Now:

     - popular queries are computed from the localities that actually have the
       most inventory in the active scope, with real counts
     - matches are ranked (exact > prefix > word-prefix > substring > typo)
     - a six-digit PIN suggests the localities that serve it
     - a query the parser understands ("3 bhk in koramangala under 2 cr")
       becomes a structured suggestion that states what it will do

   Suggestion text is never generated free-form: every label comes from the
   registry, inventory, or the user's own words. */

import { liveCities } from "@/lib/cities";
import { localities } from "@/lib/localities";
import { getListings } from "@/lib/repositories";
import { localitiesForPincode, parsePincode, resolvePincode } from "@/lib/pincodes";
import { describeParsedQuery, formatBudget, parseSearchQuery, parsedQueryToSearchUrl } from "./parse-query";
import { bestMatch, fold } from "./text-match";

export type SearchSuggestionKind = "locality" | "listing" | "popular" | "query" | "city" | "pincode" | "structured";

export type SearchSuggestion = {
  kind: SearchSuggestionKind;
  label: string;
  query: string;
  /** Optional human hint (e.g. "42 homes · Paldi"). */
  hint?: string;
  /** Canonical destination when the suggestion maps to a structured search. */
  href?: string;
};

export const MAX_SUGGESTIONS = 8;

/* ---------- Inventory-derived facts ---------- */

type Scope = { citySlug?: string };

function scopedListings(scope: Scope) {
  const listings = getListings();
  if (!scope.citySlug || scope.citySlug === "all") return listings;
  return listings.filter((listing) => listing.citySlug === scope.citySlug);
}

/** Listing count per locality slug, for honest "N homes" hints. */
function inventoryByLocality(scope: Scope): Map<string, number> {
  const counts = new Map<string, number>();
  for (const listing of scopedListings(scope)) {
    counts.set(listing.localitySlug, (counts.get(listing.localitySlug) ?? 0) + 1);
  }
  return counts;
}

/**
 * A round budget that actually splits the scoped inventory: the nearest tidy
 * step below the median price. An invented "Under ₹1 Cr" chip that matches
 * nothing (or everything) is worse than no chip at all.
 */
function medianBudget(scope: Scope): number | undefined {
  const prices = scopedListings(scope)
    .filter((listing) => (listing.transaction ?? "buy") === "buy")
    .map((listing) => listing.priceNum)
    .sort((a, b) => a - b);
  if (prices.length === 0) return undefined;
  const median = prices[Math.floor(prices.length / 2)];
  const steps = [5_000_000, 7_500_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000, 50_000_000, 100_000_000];
  return steps.find((step) => step >= median) ?? steps[steps.length - 1];
}

/**
 * Popular queries for a scope, derived from inventory rather than authored.
 * Stable for a given registry, so snapshots and caches stay valid.
 */
export function popularQueries(scope: Scope = {}, limit = 5): SearchSuggestion[] {
  const counts = inventoryByLocality(scope);
  const suggestions: SearchSuggestion[] = [];

  const topLocalities = [...counts.entries()]
    .map(([slug, count]) => ({ locality: localities.find((item) => item.slug === slug), count }))
    .filter((entry): entry is { locality: NonNullable<(typeof localities)[number]>; count: number } => Boolean(entry.locality))
    // Ties break on slug so the order never depends on Map insertion.
    .sort((a, b) => b.count - a.count || a.locality.slug.localeCompare(b.locality.slug))
    .slice(0, 3);

  for (const { locality, count } of topLocalities) {
    suggestions.push({
      kind: "popular",
      label: locality.name,
      query: locality.name,
      hint: `${count} ${count === 1 ? "home" : "homes"} · ${locality.cityName}`,
    });
  }

  const budget = medianBudget(scope);
  if (budget) {
    const label = `Under ${formatBudget(budget)}`;
    const matching = scopedListings(scope).filter((listing) => listing.priceNum < budget).length;
    suggestions.push({ kind: "popular", label, query: label, hint: `${matching} homes` });
  }

  const rera = scopedListings(scope).filter((listing) => listing.badge === "RERA verified").length;
  if (rera > 0) suggestions.push({ kind: "popular", label: "RERA verified", query: "RERA verified", hint: `${rera} homes` });

  // Nationwide, the most useful next step is often picking a city.
  if (!scope.citySlug || scope.citySlug === "all") {
    const busiest = [...liveCities]
      .map((city) => ({ city, count: getListings().filter((listing) => listing.citySlug === city.slug).length }))
      .sort((a, b) => b.count - a.count || a.city.slug.localeCompare(b.city.slug))[0];
    if (busiest && busiest.count > 0) {
      suggestions.push({
        kind: "city",
        label: busiest.city.name,
        query: busiest.city.name,
        hint: `${busiest.count} homes · ${busiest.city.state}`,
        href: `/buy/${busiest.city.slug}/`,
      });
    }
  }

  return suggestions.slice(0, limit);
}

/* ---------- Ranked suggestion search ---------- */

type Scored = { suggestion: SearchSuggestion; score: number; tieBreak: number };

/**
 * Return up to `limit` suggestions relevant to `query`, best first.
 * A blank query returns inventory-derived popular queries for the scope.
 */
export function suggestSearch(query: string, limit = MAX_SUGGESTIONS, scope: Scope = {}): SearchSuggestion[] {
  const trimmed = query.trim();
  if (!trimmed) return popularQueries(scope, limit);

  const counts = inventoryByLocality({});
  const scored: Scored[] = [];
  const seen = new Set<string>();

  const push = (suggestion: SearchSuggestion, score: number, tieBreak: number) => {
    const key = `${suggestion.kind}:${fold(suggestion.query)}`;
    if (seen.has(key)) return;
    seen.add(key);
    scored.push({ suggestion, score, tieBreak });
  };

  // 1. A PIN is unambiguous — answer it directly and first.
  const pincode = parsePincode(trimmed);
  if (pincode) {
    const served = localitiesForPincode(pincode);
    for (const locality of served) {
      push(
        {
          kind: "pincode",
          label: `${locality.name} — PIN ${pincode}`,
          query: locality.name,
          hint: `${counts.get(locality.slug) ?? 0} homes · ${locality.cityName}`,
          href: `/search/?pincode=${pincode}`,
        },
        130,
        counts.get(locality.slug) ?? 0,
      );
    }
    if (served.length === 0) {
      const resolved = resolvePincode(pincode);
      if (resolved) {
        push(
          {
            kind: "pincode",
            label: `PIN ${pincode} — ${resolved.city.name}`,
            query: resolved.city.name,
            hint: `No locality in this PIN yet · showing ${resolved.city.name}`,
            href: `/buy/${resolved.city.slug}/`,
          },
          125,
          0,
        );
      }
    }
  }

  // 2. A query the parser understands becomes an explicit structured action.
  const parsed = parseSearchQuery(trimmed, scope.citySlug);
  const description = describeParsedQuery(parsed);
  // Only worth offering when it adds something beyond a plain place lookup.
  const structuredIsInteresting =
    parsed.understood && (parsed.bhk !== undefined || parsed.maxPriceInr !== undefined || parsed.filters.length > 0 || parsed.intent === "rent");
  if (structuredIsInteresting && description) {
    push({ kind: "structured", label: description, query: trimmed, hint: "Search with these filters", href: parsedQueryToSearchUrl(parsed) }, 120, 0);
  }
  // Places named inside a longer sentence ("3 bhk in koramangala under 2 cr")
  // are worth offering on their own — the whole sentence will never match a
  // locality name directly. Only for multi-word queries: for a single word the
  // direct ranking below is both better and scope-aware.
  for (const locality of /\s/.test(trimmed) ? parsed.localities : []) {
    const count = counts.get(locality.slug) ?? 0;
    push(
      {
        kind: "locality",
        label: `${locality.name}, ${locality.cityName}`,
        query: locality.name,
        hint: `${count} ${count === 1 ? "home" : "homes"} · ${locality.note}`,
        href: `/buy/${locality.citySlug}/${locality.slug}/`,
      },
      95,
      count,
    );
  }

  // 3. Localities, ranked by match quality then by real inventory.
  for (const locality of localities) {
    const result = bestMatch([locality.name, locality.hindi, locality.slug.replace(/-/g, " ")], trimmed);
    if (!result) continue;
    const count = counts.get(locality.slug) ?? 0;
    // Localities in the active city scope surface above equally-good matches
    // elsewhere, because that is where the person is already looking.
    const scopeBoost = scope.citySlug && scope.citySlug !== "all" && locality.citySlug === scope.citySlug ? 12 : 0;
    push(
      {
        kind: "locality",
        label: `${locality.name}, ${locality.cityName}`,
        query: locality.name,
        hint: `${count} ${count === 1 ? "home" : "homes"} · ${locality.note}`,
        href: `/buy/${locality.citySlug}/${locality.slug}/`,
      },
      result.score + scopeBoost,
      count,
    );
  }

  // 4. Cities.
  for (const city of liveCities) {
    const result = bestMatch([city.name, city.hindi, city.slug.replace(/-/g, " ")], trimmed);
    if (!result) continue;
    const count = getListings().filter((listing) => listing.citySlug === city.slug).length;
    push(
      {
        kind: "city",
        label: city.name,
        query: city.name,
        hint: `${count} homes · ${city.state}`,
        href: `/buy/${city.slug}/`,
      },
      result.score + 6,
      count,
    );
  }

  // 5. Listings, scored a tier below places: a place is a better answer to a
  //    short query than one specific home that happens to share a word.
  for (const listing of scopedListings(scope)) {
    const result = bestMatch([listing.title, listing.project ?? "", listing.developer ?? ""], trimmed);
    if (!result) continue;
    push(
      {
        kind: "listing",
        label: listing.title,
        query: listing.title,
        hint: `${listing.locality}, ${listing.city} · ${listing.price}`,
        href: `/listing/${listing.id}/`,
      },
      result.score - 20,
      listing.priceNum,
    );
  }

  // 6. Popular queries that contain what was typed, as a last resort.
  for (const popular of popularQueries(scope, 6)) {
    const result = bestMatch([popular.label], trimmed);
    if (!result) continue;
    push(popular, result.score - 30, 0);
  }

  scored.sort((a, b) => b.score - a.score || b.tieBreak - a.tieBreak || a.suggestion.label.localeCompare(b.suggestion.label));
  return scored.slice(0, limit).map((entry) => entry.suggestion);
}

/**
 * Suggestions for typing a raw query, including a "search for exactly this"
 * entry.
 *
 * The raw entry leads only when nothing else matched. Putting it first
 * unconditionally meant a typo like "koramangla" offered the typo above the
 * correction — the worst of both worlds.
 */
export function suggestSearchIncludingRaw(query: string, limit = MAX_SUGGESTIONS, scope: Scope = {}): SearchSuggestion[] {
  const q = query.trim();
  const matches = suggestSearch(q, limit, scope);
  if (!q || matches.some((item) => fold(item.query) === fold(q))) return matches;

  const rawEntry: SearchSuggestion = { kind: "query", label: q, query: q, hint: "Search for exactly this" };
  if (matches.length === 0) return [rawEntry];
  return [...matches, rawEntry].slice(0, limit);
}

/**
 * A placeholder example built from real inventory, so the hint in the search
 * box is always a query that would genuinely return something.
 */
export function exampleQuery(scope: Scope = {}): string {
  const counts = inventoryByLocality(scope);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const locality = top ? localities.find((item) => item.slug === top[0]) : undefined;
  return locality ? `3 BHK in ${locality.name}` : "3 BHK";
}
