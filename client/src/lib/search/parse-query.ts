/* Query understanding.

   Turns what someone actually types — "3 bhk in koramangala under 2 cr",
   "rent 2bhk 411057", "villa in whitefield ready to move" — into the structured
   scope the search API already speaks: city, localities, PIN, BHK, budget,
   intent, category and filter ids.

   This is a deterministic grammar over the place registry and the filter
   vocabulary, not a language model. Every token it consumes is one it can name,
   and anything it does not understand is preserved in `residual` and passed
   through as free text, so understanding a query can never lose information.

   Shared by the suggestion box, the results header, and the no-results
   recovery panel, so all three explain the query the same way. */

import { cities, liveCities, type City } from "@/lib/cities";
import { localities, type Locality } from "@/lib/localities";
import { parsePincode, resolvePincode } from "@/lib/pincodes";
import type { MarketCategory, MarketIntent } from "@/lib/filters";
import { bestMatch } from "./text-match";

export type ParsedQuery = {
  /** The query exactly as typed. */
  raw: string;
  bhk?: number;
  /** Upper price bound in rupees, from "under 1.5 cr" / "below 80 lakh". */
  maxPriceInr?: number;
  intent?: MarketIntent;
  category?: Exclude<MarketCategory, "all">;
  city?: City;
  localities: Locality[];
  pincode?: string;
  /** Filter ids implied by the query, in the vocabulary of `makeFilters()`. */
  filters: string[];
  /** Tokens the parser did not claim; kept as free text for the matcher. */
  residual: string;
  /** True when at least one structured element was recognised. */
  understood: boolean;
};

/* ---------- Vocabulary ----------
   Each entry maps a set of spoken forms onto one structured outcome. Keeping
   them in data (rather than a chain of regexes) means the parser and the
   suggestion box cannot drift apart. */

const INTENT_WORDS: { intent: MarketIntent; words: string[] }[] = [
  { intent: "rent", words: ["rent", "rental", "rentals", "lease", "kiraya", "किराया"] },
  { intent: "buy", words: ["buy", "sale", "purchase", "kharidna", "ख़रीद", "खरीद"] },
];

const CATEGORY_WORDS: { category: Exclude<MarketCategory, "all">; words: string[] }[] = [
  { category: "commercial", words: ["commercial", "office", "offices", "shop", "showroom", "retail"] },
  { category: "pg", words: ["pg", "hostel", "coliving", "co-living"] },
  { category: "plot", words: ["plot", "plots"] },
  { category: "land", words: ["land", "farmland", "agricultural"] },
  { category: "auction", words: ["auction", "auctions", "repossessed"] },
  { category: "residential", words: ["residential", "home", "homes", "house", "houses", "flat", "flats", "apartment", "apartments"] },
];

const FILTER_PHRASES: { id: string; phrases: string[] }[] = [
  { id: "rera", phrases: ["rera verified", "rera-verified", "rera"] },
  { id: "availability-ready", phrases: ["ready to move", "ready-to-move", "ready possession", "move in ready"] },
  { id: "availability-new", phrases: ["new launch", "new-launch", "newly launched", "pre launch"] },
  { id: "availability-resale", phrases: ["resale", "re-sale"] },
  { id: "type-apartment", phrases: ["apartment", "flat"] },
  { id: "type-villa", phrases: ["villa", "bungalow"] },
  { id: "type-rowhouse", phrases: ["rowhouse", "row house"] },
];

/** Words that carry no scope on their own and should never reach place matching. */
const STOP_WORDS = new Set([
  "in", "at", "near", "nearby", "around", "the", "a", "an", "for", "with", "and", "of", "to",
  "me", "my", "property", "properties", "bhk", "under", "below", "upto", "up", "budget",
  "within", "cr", "crore", "crores", "lakh", "lakhs", "lac", "l",
]);

/* ---------- Number parsing ---------- */

/** "1.5 cr" → 15000000, "80 lakh" → 8000000. */
function toRupees(amount: number, unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized.startsWith("c")) return Math.round(amount * 10_000_000);
  if (normalized.startsWith("k")) return Math.round(amount * 1_000);
  return Math.round(amount * 100_000);
}

const PRICE_PATTERN = /(?:under|below|upto|up\s*to|within|max)\s*₹?\s*([\d.]+)\s*(cr|crore|crores|l|lac|lakh|lakhs|k)\b/i;
const BHK_PATTERN = /(\d+)\s*(?:bhk|bedroom|bedrooms|bed)\b/i;

/* ---------- Place matching ---------- */

/**
 * Resolve a place name from a window of consecutive tokens. Multi-word names
 * ("prahlad nagar", "hsr layout") are tried longest-first so the longer, more
 * specific name always wins over one of its words.
 */
function matchPlaces(tokens: string[]): { city?: City; localities: Locality[]; consumed: Set<number> } {
  const consumed = new Set<number>();
  const matchedLocalities: Locality[] = [];
  let matchedCity: City | undefined;

  for (let size = 4; size >= 1; size -= 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      const indices = Array.from({ length: size }, (_, offset) => start + offset);
      if (indices.some((index) => consumed.has(index))) continue;

      const phrase = indices.map((index) => tokens[index]).join(" ");
      if (!phrase || STOP_WORDS.has(phrase)) continue;
      // Single very short tokens are only ever matched exactly, so "pal" cannot
      // drag in half the registry.
      const exactOnly = phrase.length <= 3;

      const locality = bestLocality(phrase, exactOnly);
      if (locality && !matchedLocalities.some((item) => item.slug === locality.slug)) {
        matchedLocalities.push(locality);
        indices.forEach((index) => consumed.add(index));
        continue;
      }

      if (!matchedCity) {
        const city = bestCity(phrase, exactOnly);
        if (city) {
          matchedCity = city;
          indices.forEach((index) => consumed.add(index));
        }
      }
    }
  }

  return { city: matchedCity, localities: matchedLocalities, consumed };
}

function bestLocality(phrase: string, exactOnly: boolean): Locality | undefined {
  let best: { locality: Locality; score: number } | undefined;
  for (const locality of localities) {
    const result = bestMatch([locality.name, locality.hindi, locality.slug.replace(/-/g, " ")], phrase);
    if (!result) continue;
    if (exactOnly && result.quality !== "exact") continue;
    // A bare substring is too weak to claim a place from a multi-word query.
    if (result.quality === "substring" || result.quality === "fuzzy") {
      if (phrase.length < 5) continue;
    }
    if (!best || result.score > best.score || (result.score === best.score && locality.homes > best.locality.homes)) {
      best = { locality, score: result.score };
    }
  }
  return best && best.score >= 46 ? best.locality : undefined;
}

function bestCity(phrase: string, exactOnly: boolean): City | undefined {
  let best: { city: City; score: number } | undefined;
  for (const city of liveCities) {
    const result = bestMatch([city.name, city.hindi, city.slug.replace(/-/g, " ")], phrase);
    if (!result) continue;
    if (exactOnly && result.quality !== "exact") continue;
    if (!best || result.score > best.score) best = { city, score: result.score };
  }
  return best && best.score >= 46 ? best.city : undefined;
}

/* ---------- Parser ---------- */

/**
 * Parse a free-text search query into structured scope.
 * @param raw   the query as typed
 * @param scope optional active city slug, used when the query names a locality
 *              without naming its city
 */
export function parseSearchQuery(raw: string, scope?: string): ParsedQuery {
  const parsed: ParsedQuery = { raw, localities: [], filters: [], residual: "", understood: false };
  let working = ` ${raw.toLowerCase().normalize("NFKC")} `;

  // 1. PIN — the most specific thing a query can contain.
  const pincode = parsePincode(raw);
  if (pincode) {
    parsed.pincode = pincode;
    working = working.replace(new RegExp(`(?<![0-9])${pincode}(?![0-9])`, "g"), " ");
    const resolved = resolvePincode(pincode);
    if (resolved) {
      parsed.city = resolved.city;
      parsed.localities = [...resolved.localities];
    }
  }

  // 2. Budget, before BHK, so "under 3 cr" cannot be read as a bedroom count.
  const price = working.match(PRICE_PATTERN);
  if (price) {
    parsed.maxPriceInr = toRupees(Number.parseFloat(price[1]), price[2]);
    working = working.replace(PRICE_PATTERN, " ");
  }

  // 3. BHK.
  const bhk = working.match(BHK_PATTERN);
  if (bhk) {
    const value = Number.parseInt(bhk[1], 10);
    if (value > 0 && value <= 20) parsed.bhk = value;
    working = working.replace(BHK_PATTERN, " ");
  }

  // 4. Multi-word filter phrases, longest form first.
  for (const { id, phrases } of FILTER_PHRASES) {
    for (const phrase of [...phrases].sort((a, b) => b.length - a.length)) {
      if (!working.includes(` ${phrase} `) && !working.includes(`${phrase} `)) continue;
      if (!working.match(new RegExp(`(?<![\\p{L}])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u"))) continue;
      if (!parsed.filters.includes(id)) parsed.filters.push(id);
      working = working.replace(new RegExp(`(?<![\\p{L}])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "gu"), " ");
      break;
    }
  }

  // 5. Intent and category words.
  for (const { intent, words } of INTENT_WORDS) {
    for (const word of words) {
      if (!new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, "u").test(working)) continue;
      parsed.intent ??= intent;
      working = working.replace(new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, "gu"), " ");
    }
  }
  for (const { category, words } of CATEGORY_WORDS) {
    for (const word of words) {
      if (!new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, "u").test(working)) continue;
      parsed.category ??= category;
      working = working.replace(new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, "gu"), " ");
    }
  }

  // 6. Places from whatever is left.
  // \p{M} matters: Devanagari vowel signs are combining marks, not letters, so
  // omitting them shreds "पालडी" into "प" and "लड" and no place ever matches.
  const tokens = working.split(/[^\p{L}\p{N}\p{M}]+/u).filter((token) => token && !STOP_WORDS.has(token));
  if (tokens.length > 0 && (!parsed.city || parsed.localities.length === 0)) {
    const places = matchPlaces(tokens);
    if (!parsed.city && places.city) parsed.city = places.city;
    for (const locality of places.localities) {
      if (!parsed.localities.some((item) => item.slug === locality.slug)) parsed.localities.push(locality);
    }
    parsed.residual = tokens.filter((_, index) => !places.consumed.has(index)).join(" ");
  } else {
    parsed.residual = tokens.join(" ");
  }

  // A locality names its own city; an explicit city in the query wins over the
  // ambient scope, and the ambient scope is only a fallback.
  if (!parsed.city && parsed.localities.length > 0) {
    parsed.city = cities.find((city) => city.slug === parsed.localities[0].citySlug);
  }
  if (!parsed.city && scope && scope !== "all") {
    parsed.city = liveCities.find((city) => city.slug === scope);
  }

  // Budget maps onto the one price filter the UI exposes, so a parsed budget
  // and a clicked chip cannot disagree.
  if (parsed.maxPriceInr !== undefined && parsed.maxPriceInr <= 15_000_000 && !parsed.filters.includes("under15")) {
    parsed.filters.push("under15");
  }
  if (parsed.bhk === 2 && !parsed.filters.includes("2bhk")) parsed.filters.push("2bhk");
  if (parsed.bhk !== undefined && parsed.bhk >= 3 && !parsed.filters.includes("3bhk")) parsed.filters.push("3bhk");

  parsed.understood = Boolean(
    parsed.bhk !== undefined ||
      parsed.maxPriceInr !== undefined ||
      parsed.pincode ||
      parsed.city ||
      parsed.localities.length > 0 ||
      parsed.intent ||
      parsed.category ||
      parsed.filters.length > 0,
  );

  return parsed;
}

/** Format rupees the way the rest of the product does: ₹1.5 Cr, ₹80 L. */
export function formatBudget(rupees: number): string {
  if (rupees >= 10_000_000) {
    const crore = rupees / 10_000_000;
    return `₹${Number.isInteger(crore) ? crore : crore.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} Cr`;
  }
  return `₹${Math.round(rupees / 100_000)} L`;
}

/**
 * A short, human sentence describing what the parsed query will actually do.
 * Shown next to the suggestion so the interpretation is never a surprise.
 */
export function describeParsedQuery(parsed: ParsedQuery): string {
  const parts: string[] = [];
  if (parsed.bhk !== undefined) parts.push(`${parsed.bhk} BHK`);
  if (parsed.category && parsed.category !== "residential") parts.push(parsed.category);
  if (parsed.filters.includes("type-villa")) parts.push("villa");
  if (parsed.filters.includes("type-rowhouse")) parts.push("rowhouse");
  if (parsed.intent === "rent") parts.push("to rent");
  if (parsed.localities.length > 0) {
    parts.push(`in ${parsed.localities.map((locality) => locality.name).join(" / ")}`);
  } else if (parsed.city) {
    parts.push(`in ${parsed.city.name}`);
  }
  if (parsed.pincode) parts.push(`PIN ${parsed.pincode}`);
  if (parsed.maxPriceInr !== undefined) parts.push(`under ${formatBudget(parsed.maxPriceInr)}`);
  if (parsed.filters.includes("rera")) parts.push("RERA verified");
  if (parsed.filters.includes("availability-ready")) parts.push("ready to move");
  if (parsed.filters.includes("availability-new")) parts.push("new launch");
  return parts.join(" · ");
}

/**
 * The text that must stay in `q` because no URL parameter can carry it.
 *
 * Rewriting a query into parameters is only safe if it is lossless. Locality
 * names have no parameter of their own (city does, locality does not), and a
 * budget above the one price filter the UI exposes would otherwise vanish — so
 * both are handed back as free text, which the matcher already understands.
 */
export function residualQueryText(parsed: ParsedQuery): string {
  const parts: string[] = [];
  if (parsed.residual) parts.push(parsed.residual);

  // Free-text tokens are AND-ed by the matcher, so two locality names in `q`
  // would match nothing at all. A single name is safe; several are already
  // represented by the PIN or city parameter, which is an OR over the group.
  if (!parsed.pincode && parsed.localities.length === 1) parts.push(parsed.localities[0].name);
  if (parsed.maxPriceInr !== undefined && !parsed.filters.includes("under15")) {
    parts.push(`under ${parsed.maxPriceInr / 10_000_000} cr`);
  }
  if (parsed.bhk !== undefined && !parsed.filters.includes("2bhk") && !parsed.filters.includes("3bhk")) {
    parts.push(`${parsed.bhk} bhk`);
  }
  return parts.join(" ").trim();
}

/**
 * Merge a parsed query into an existing parameter set. Structured parts become
 * real URL parameters (shareable, and understood by the API without re-parsing)
 * and everything else is preserved as free text.
 */
export function applyParsedQueryToParams(parsed: ParsedQuery, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);

  const freeText = residualQueryText(parsed);
  if (freeText) params.set("q", freeText);
  else params.delete("q");

  if (parsed.city) params.set("city", parsed.city.slug);
  if (parsed.pincode) params.set("pincode", parsed.pincode);
  if (parsed.category && parsed.category !== "residential") params.set("category", parsed.category);
  else if (parsed.category === "residential") params.delete("category");
  if (parsed.intent === "rent") params.set("intent", "rent");
  else if (parsed.intent === "buy") params.delete("intent");

  if (parsed.filters.length) {
    // Union with anything already selected: typing never silently drops a
    // filter the person clicked earlier.
    const existing = (params.get("filters") ?? "").split(",").filter(Boolean);
    const merged = [...new Set([...existing, ...parsed.filters])];
    params.set("filters", merged.join(","));
  }

  return params;
}

/** Canonical search URL for a parsed query. */
export function parsedQueryToSearchUrl(parsed: ParsedQuery, base?: URLSearchParams): string {
  const query = applyParsedQueryToParams(parsed, base).toString();
  return `/search/${query ? `?${query}` : ""}`;
}
