/* Keyword URLs → canonical destination (StudyArena round-12, contestant F §1 and §4).

   F's core example queries are shapes like "2 bhk for rent in [locality]", and
   the site has always accepted them as URL slugs: `/property/2bhk-rent-...`
   and `/property-search/2bhk-rent-...`. Both routes answered them by sniffing
   the joined string for a handful of hardcoded words:

     · `/property/` recognised exactly two cities — anything without the
       string "gandhinagar" was served as **Ahmedabad**, so a Bengaluru or
       Pune slug redirected to an Ahmedabad search.
     · `/property-search/` carried a hardcoded list of ten Ahmedabad
       localities; a slug naming any of the other 62 produced an empty query.

   Two routes, two copies of the same idea, both wrong outside Ahmedabad and
   already drifting from each other. The site grew to 12 cities and 72
   localities while they were still matching on literals.

   The resolution is not to maintain a third list. `parseSearchQuery` already
   understands BHK, budget, intent, category, PIN codes and place names
   against the live registry, and `parsedQueryToSearchUrl` already produces the
   canonical search URL the rest of the app uses. These routes now ask it. */
import { parsedQueryToSearchUrl, parseSearchQuery } from "./parse-query";

/** Turn a keyword slug's segments into text the parser can read.

    Segments arrive hyphenated (`2bhk-rent-bandra-west`) because a hyphen is
    what reads as a space inside a URL path. The parser splits on anything that
    is not a letter, number or combining mark, so hyphens and spaces are
    equivalent to it — spaces are used here only so a caller reading a
    debug line sees something legible. */
function slugToText(segments: readonly string[]): string {
  return segments.join(" ").replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Canonical search URL for a keyword slug.

    An empty slug yields the bare search surface rather than a guessed city:
    with nothing to go on, the honest answer is "let them search", not
    "assume Ahmedabad". */
export function keywordSlugToSearchUrl(segments: readonly string[]): string {
  const text = slugToText(segments);
  if (!text) return "/search/";
  return parsedQueryToSearchUrl(parseSearchQuery(text));
}
