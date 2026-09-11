/* Text matching primitives for search suggestions.

   Suggestion relevance used to be a bare `String.includes`, which ranked a
   substring hit in the middle of a long name exactly as highly as an exact
   match, and returned everything in registry order — so Ahmedabad localities
   always won regardless of what was typed.

   These helpers are deliberately small and auditable rather than a fuzzy
   search engine: every score is explainable, and typo tolerance is bounded so
   it can never invent a match that a human would not accept. */

import { normalizeLocalityToken } from "./aliases";

/** Fold a value to the canonical matching form (lowercase, Latin, unaccented). */
export function fold(value: string): string {
  return normalizeLocalityToken(value);
}

/**
 * Damerau-Levenshtein distance, abandoned as soon as it exceeds `max`.
 * Bounding it keeps the cost linear for the common "these are nothing alike"
 * case and guarantees we never accept a wild correction.
 */
export function editDistanceWithin(a: string, b: string, max: number): number | null {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return null;

  const previous: number[] = Array.from({ length: b.length + 1 }, (_, index) => index);
  let beforePrevious: number[] = [];

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i, ...Array.from({ length: b.length }, () => 0)];
    let rowBest = current[0];

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      // Transposition: "koramangla" vs "koramangala" style slips.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, beforePrevious[j - 2] + 1);
      }
      current[j] = value;
      if (value < rowBest) rowBest = value;
    }

    if (rowBest > max) return null;
    beforePrevious = previous.slice();
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  const distance = previous[b.length];
  return distance <= max ? distance : null;
}

/**
 * Typo tolerance scaled to word length. Short words get none: at three
 * characters almost every other short word is one edit away, so tolerance
 * there produces noise, not help.
 */
export function typoBudget(length: number): number {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  return 2;
}

export type MatchQuality = "exact" | "prefix" | "word-prefix" | "substring" | "fuzzy";

export type MatchResult = { score: number; quality: MatchQuality };

const QUALITY_SCORE: Record<MatchQuality, number> = {
  exact: 100,
  prefix: 82,
  "word-prefix": 68,
  substring: 46,
  fuzzy: 30,
};

/**
 * Score how well `candidate` answers `query`, or null when it does not.
 * Both sides are folded, so "पालडी", "Paldi" and "paldi" score identically.
 */
export function matchQuality(candidate: string, query: string): MatchResult | null {
  const target = fold(candidate);
  const needle = fold(query);
  if (!target || !needle) return null;

  if (target === needle) return { score: QUALITY_SCORE.exact, quality: "exact" };
  if (target.startsWith(needle)) return { score: QUALITY_SCORE.prefix, quality: "prefix" };
  // A hit at the start of any word: "nagar" should surface "Prahlad Nagar".
  if (target.split(/[\s-]+/).some((word) => word.startsWith(needle))) {
    return { score: QUALITY_SCORE["word-prefix"], quality: "word-prefix" };
  }
  if (target.includes(needle)) return { score: QUALITY_SCORE.substring, quality: "substring" };

  // Typo tolerance only against the whole candidate or one of its words, never
  // against an arbitrary slice, so "bopal" cannot fuzzy-match "Piplod".
  const budget = typoBudget(needle.length);
  if (budget > 0) {
    const words = [target, ...target.split(/[\s-]+/)];
    let best: number | null = null;
    for (const word of words) {
      const distance = editDistanceWithin(needle, word, budget);
      if (distance !== null && (best === null || distance < best)) best = distance;
    }
    if (best !== null) return { score: QUALITY_SCORE.fuzzy - (best - 1) * 6, quality: "fuzzy" };
  }

  return null;
}

/** Best score across several labels for the same entity (name, native name, slug). */
export function bestMatch(candidates: string[], query: string): MatchResult | null {
  let best: MatchResult | null = null;
  for (const candidate of candidates) {
    const result = matchQuality(candidate, query);
    if (result && (!best || result.score > best.score)) best = result;
  }
  return best;
}
