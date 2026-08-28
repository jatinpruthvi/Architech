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

/**
 * Normalize a token into a lowercase, Latin-oriented canonical form for matching.
 * Strips diacritics, maps Devanagari characters, and collapses whitespace.
 */
export function normalizeLocalityToken(value: string): string {
  let normalized = value.normalize("NFKC").toLowerCase();
  // Map Devanagari consonants/vowels and combining signs to Latin.
  normalized = normalized.replace(/[\u0900-\u097F]/g, (char) => DEVANAGARI_TO_LATIN[char] ?? VOWEL_SIGNS[char] ?? "");
  // Strip Latin accents/marks.
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/\s+/g, " ").trim();
}

/** Build the set of canonical search aliases for a locality. */
export function localityAliases(localitySlug: string): string[] {
  const locality = localities.find((item) => item.slug === localitySlug);
  if (!locality) return [];
  const names = new Set<string>();
  names.add(normalizeLocalityToken(locality.name));
  names.add(normalizeLocalityToken(locality.hindi));
  // Latin renderings of the Devanagari name.
  names.add(normalizeLocalityToken(locality.hindi).replace(/ /g, ""));
  return [...names].filter(Boolean);
}

/** True when a query token matches a locality by name, Devanagari, or alias. */
export function localityMatchesToken(slug: string, token: string): boolean {
  const normalized = normalizeLocalityToken(token);
  if (!normalized) return false;
  return localityAliases(slug).some((alias) => alias.includes(normalized));
}

/** True when a query token matches a locality identified by its English name. */
export function localityNameMatchesToken(name: string, token: string): boolean {
  const locality = localities.find((item) => item.name.toLowerCase() === name.toLowerCase());
  return locality ? localityMatchesToken(locality.slug, token) : false;
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
