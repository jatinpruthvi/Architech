/* Search alias & transliteration module.
   Enables mixed-language matching so a query typed in Devanagari, Latin, or a
   common alias resolves to the same locality. Pure, deterministic, server-safe.

   Transliteration is intentionally conservative (a small, curated Devanagari →
   Latin mapping for Ahmedabad place names) rather than a general IAST engine, so
   it stays auditable and avoids introducing wrong matches. English aliases make
   the module useful when a neighbourhood is known by more than one name. */

import { localities } from "@/lib/localities";

/** Standard Latin → Hindi (Devanagari) mapping used by the UI dictionary. */
const HINDI_ALIAS: Record<string, string> = Object.fromEntries(
  localities.map((locality) => [locality.name.toLowerCase(), locality.hindi]),
);

/** Devanagari → Latin normalization for query-time matching. */
const DEVANAGARI_TO_LATIN: Record<string, string> = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
  "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "च": "ch", "छ": "chh",
  "ज": "j", "झ": "jh", "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n", "प": "p",
  "फ": "f", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r",
  "ल": "l", "व": "v", "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  "ड़": "r", "ढ़": "rh",
};

const VOWEL_SIGNS: Record<string, string> = {
  "ा": "a", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};

/* ---------- Registry indexes (latency) ----------

   The registry is a STATIC in-memory fixture (loaded once at import), so the
   lookups below are pure functions of (slug, name, token) for the process
   lifetime. The matchers used to `Array.find` the whole registry — and rebuild
   the normalized alias set from scratch — on EVERY (listing, token) pair: at
   the 5,000-row ceiling that is O(rows × tokens × localities) work. The
   prebuilt maps below collapse each of those to O(1) with identical
   first-wins semantics (the maps are built in registry order). */
/* bounded-state: both maps are populated once at module load by the loop
   below, in registry order; the registry never mutates at runtime. */
const slugIndex = new Map<string, (typeof localities)[number]>();
const lowerNameToSlug = new Map<string, string>();
for (const locality of localities) {
  if (!slugIndex.has(locality.slug)) slugIndex.set(locality.slug, locality);
  const nameKey = locality.name.toLowerCase();
  if (!lowerNameToSlug.has(nameKey)) lowerNameToSlug.set(nameKey, locality.slug);
}

/** Bounded memo for normalized tokens: token text is low-cardinality per
    process (a handful per query × a handful of queries), and the function is
    pure, so clearing the cache can only change speed, never output. */
const normalizedTokenCache = new Map<string, string>();

/**
 * Normalize a token into a lowercase, Latin-oriented canonical form for matching.
 * Strips diacritics, maps Devanagari characters, and collapses whitespace.
 */
export function normalizeLocalityToken(value: string): string {
  const cached = normalizedTokenCache.get(value);
  if (cached !== undefined) return cached;
  let normalized = value.normalize("NFKC").toLowerCase();
  // Map Devanagari consonants/vowels and combining signs to Latin.
  normalized = normalized.replace(/[\u0900-\u097F]/g, (char) => DEVANAGARI_TO_LATIN[char] ?? VOWEL_SIGNS[char] ?? "");
  // Strip Latin accents/marks.
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const result = normalized.replace(/\s+/g, " ").trim();
  if (normalizedTokenCache.size > 4096) normalizedTokenCache.clear();
  normalizedTokenCache.set(value, result);
  return result;
}

/** Slug → alias set, built lazily and memoized (the registry never mutates). */
/* bounded-state: memoized one entry per locality slug in the registry; the
   key set is the fixture registry, never request input. */
const aliasesBySlug = new Map<string, string[]>();

/** Build the set of canonical search aliases for a locality. */
export function localityAliases(localitySlug: string): string[] {
  const cached = aliasesBySlug.get(localitySlug);
  if (cached) return cached;
  const locality = slugIndex.get(localitySlug);
  if (!locality) return [];
  const names = new Set<string>();
  names.add(normalizeLocalityToken(locality.name));
  names.add(normalizeLocalityToken(locality.hindi));
  // Latin renderings of the Devanagari name.
  names.add(normalizeLocalityToken(locality.hindi).replace(/ /g, ""));
  // The English name without spaces ("prahladnagar"): a search box receives the
  // concatenated form far more often than the two-word one, and a residual
  // token must still match the locality it names (P1-SEARCH-001).
  names.add(normalizeLocalityToken(locality.name).replace(/ /g, ""));
  const aliases = [...names].filter(Boolean);
  aliasesBySlug.set(localitySlug, aliases);
  return aliases;
}

/** True when a query token matches a locality by name, Devanagari, or alias. */
export function localityMatchesToken(slug: string, token: string): boolean {
  const normalized = normalizeLocalityToken(token);
  if (!normalized) return false;
  return localityAliases(slug).some((alias) => alias.includes(normalized));
}

/** True when a query token matches a locality identified by its English name. */
export function localityNameMatchesToken(name: string, token: string): boolean {
  const slug = lowerNameToSlug.get(name.toLowerCase());
  return slug ? localityMatchesToken(slug, token) : false;
}

/** Resolve a search query to any matching locality slugs, in inventory order. */
export function resolveLocalitiesFromQuery(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .normalize("NFKC")
    // Keep combining marks: Devanagari vowel signs are \p{M}, and dropping them
    // splits a word like "पालडी" into unmatchable fragments.
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const hits: string[] = [];
  for (const locality of localities) {
    if (tokens.some((token) => localityMatchesToken(locality.slug, token))) hits.push(locality.slug);
  }
  return hits;
}

/** Hindi label for an English locality name (for UI translation helpers). */
export function hindiLabelFor(name: string): string | undefined {
  return HINDI_ALIAS[name.toLowerCase()];
}
