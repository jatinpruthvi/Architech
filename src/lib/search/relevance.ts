/* Relevance ordering for search results.
 *
 * WHY THIS EXISTS
 *
 * Until now the sort vocabulary was `fresh | price-asc | price-desc`. A person
 * who types "thaltej garden duplex" and gets results ordered by *edit date* is
 * being shown an answer to a question they did not ask. `search.ts` carried a
 * standing note that relevance was deliberately not advertised because
 * `applySort` had no scoring — this module is that missing scoring, so the
 * option can be offered honestly.
 *
 * TWO PATHS, ONE MEANING
 *
 * The SQL page path orders with Postgres `ts_rank_cd` over the weighted
 * `searchVector` (migration 202609070001). The JS path cannot call
 * `ts_rank_cd`, so it approximates the SAME RANKING INTENT with the same
 * inputs: which weighted field a token hit, and how many distinct query tokens
 * matched. The two are NOT bit-identical scores, and the parity matrix asserts
 * SET equality plus a bounded rank correlation for `relevance` rather than
 * pretending byte-identical order — a claim that would be false and would fail
 * the first time Postgres retuned its ranking constants.
 *
 * WEIGHTS mirror the generated column exactly:
 *   A title (and titleHi)   — 1.0
 *   B description           — 0.4
 *   C addressLocality       — 0.2
 *   D availability          — 0.1
 * plus locality/city name, which live on joined rows rather than in the
 * vector; they are scored at the C tier because that is where the listing's
 * own copy of the locality string sits.
 *
 * DETERMINISM: ties break on the existing `fresh` order, then id — the same
 * two-level tiebreak the SQL ORDER BY uses, so a page boundary can never
 * duplicate or drop a row.
 */

import { queryResidualTokens } from "@/lib/filters";
import { fold } from "./text-match";

/** Field weights, mirroring setweight() in the searchVector definition. */
export const RELEVANCE_WEIGHTS = { A: 1.0, B: 0.4, C: 0.2, D: 0.1 } as const;

/** The shape relevance needs. Deliberately structural: both the fixture
    Property and the prisma-mapped row satisfy it without a conversion. */
export type RankableProperty = {
  id: string;
  title?: string;
  titleHi?: string | null;
  description?: string | null;
  locality?: string;
  city?: string;
  availability?: string | null;
};

function haystacks(item: RankableProperty): Array<{ text: string; weight: number }> {
  return [
    { text: `${item.title ?? ""} ${item.titleHi ?? ""}`, weight: RELEVANCE_WEIGHTS.A },
    { text: item.description ?? "", weight: RELEVANCE_WEIGHTS.B },
    { text: `${item.locality ?? ""} ${item.city ?? ""}`, weight: RELEVANCE_WEIGHTS.C },
    { text: item.availability ?? "", weight: RELEVANCE_WEIGHTS.D },
  ];
}

/**
 * Score one item against the residual tokens of a query.
 *
 * Coverage-first, mirroring `ts_rank_cd`'s cover-density behaviour: a document
 * matching MORE DISTINCT query tokens outranks one that repeats a single token,
 * which is the property that makes "thaltej garden" put a Thaltej garden flat
 * above a garden flat elsewhere. A whole-word hit outscores a substring hit at
 * the same weight, so "garden" prefers "Garden Court" over "Gardenia".
 */
export function relevanceScore(item: RankableProperty, tokens: readonly string[]): number {
  if (tokens.length === 0) return 0;
  const fields = haystacks(item).map((field) => ({ folded: fold(field.text), weight: field.weight }));

  let total = 0;
  let matchedTokens = 0;

  for (const token of tokens) {
    const needle = fold(token);
    if (!needle) continue;
    let tokenScore = 0;
    for (const field of fields) {
      if (!field.folded) continue;
      /* TERM FREQUENCY, not presence. `ts_rank_cd` is linear in the number of
         occurrences — measured on a live cluster, a title containing "garden"
         three times scores 3x one containing it once — so a max()/boolean
         here would rank a passing mention equal to the document actually
         about that term, and diverge from the SQL path (which the parity
         matrix would then fail on). Counted per field and weighted. */
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const whole = field.folded.match(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "g"))?.length ?? 0;
      if (whole > 0) {
        tokenScore += whole * field.weight;
      } else {
        // No whole-word hit: a substring still counts, at half weight, so
        // "gardenia" is findable but never outranks a true "garden".
        const partial = field.folded.split(needle).length - 1;
        if (partial > 0) tokenScore += partial * field.weight * 0.5;
      }
    }
    if (tokenScore > 0) {
      total += tokenScore;
      matchedTokens += 1;
    }
  }

  /* Cover density: reward matching a larger FRACTION of what was asked. A
     document answering 2 of 2 tokens beats one answering 2 of 3. */
  const coverage = matchedTokens / tokens.length;
  return total * (0.5 + 0.5 * coverage);
}

/**
 * Order a list by relevance to `query`, highest first.
 *
 * The input order is assumed to already be the `fresh` order, which therefore
 * becomes the tiebreak for equal scores; `id` is the final tiebreak so the
 * order is total and stable across pages. When the query has no residual
 * tokens every score is 0 and the list is returned in its existing order —
 * the honest answer, rather than a fabricated ranking.
 */
export function rankByRelevance<T extends RankableProperty>(list: T[], query: string): T[] {
  const tokens = queryResidualTokens(query);
  if (tokens.length === 0) return list;

  return list
    .map((item, index) => ({ item, index, score: relevanceScore(item, tokens) }))
    .sort((a, b) => b.score - a.score || a.index - b.index || a.item.id.localeCompare(b.item.id))
    .map((entry) => entry.item);
}
