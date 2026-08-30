/* SERP length budget (StudyArena round-12, contestant C §7 and generator spec).

   C's page spec constrains what he calls Title (≤60) and Meta (≤155), because
   the click is won or lost in the SERP, not on the page: past those lengths
   Google truncates and the tail — usually the number that would have earned
   the click — is simply gone.

   Measured across the 438 prerendered routes, 131 titles exceeded 60
   characters and 419 of 438 descriptions exceeded 155. Nothing was checking.
   The smoke suite asserted a `<title>` element *existed*, which is not the
   same as it being readable.

   So the budget is enforced in two layers:

     · `composeSerp*` builds the string from priority-ordered parts, appending
       each only while the result still fits. The most valuable fact goes
       first, so a long locality name costs a low-priority clause rather than
       the median price.
     · `fitSerp*` is the hard backstop for a single part that cannot fit at
       all, truncating on a word boundary with an ellipsis.

   The second layer is a guarantee, not a strategy. A truncated SERP snippet
   reads like a broken page, so `serp.test.ts` asserts that **no page in the
   current corpus is truncated** — if a locality name or listing note grows,
   CI fails and a human rewrites the copy instead of shipping an ellipsis. */
import type { Property } from "@/lib/repositories";
import { compactInr, formatPsf, type LocalityIntel } from "@/lib/realestate/locality-intel";

/** Characters Google renders before truncating a title. */
export const SERP_TITLE_MAX = 60;
/** Characters Google renders before truncating a description. */
export const SERP_DESCRIPTION_MAX = 155;
/** Appended to every child title by the root layout's title template. */
export const SERP_BRAND_SUFFIX = " · Architech";
/** What a page title may actually use, once the brand suffix is added. */
export const SERP_TITLE_BUDGET = SERP_TITLE_MAX - SERP_BRAND_SUFFIX.length;
export const SERP_ELLIPSIS = "…";

type Part = string | null | undefined | false;

/** Build a SERP string from priority-ordered parts.

    The first part is the subject and is always kept — if it cannot fit on its
    own, `fitSerpText` trims it. Later parts are appended while they fit and
    stop at the first that does not.

    Stopping matters more than filling every character. An earlier version kept
    trying later parts, which produced a listing page titled
    `— ₹11,000 / mo`: the subject did not fit, so the price was emitted with
    nothing it referred to. A lower-priority clause is worse than useless
    without the clause it follows. */
export function composeSerpText(parts: readonly Part[], max: number, separator = " "): string {
  let out = "";
  for (const part of parts) {
    if (!part) continue;
    const candidate = out ? `${out}${separator}${part}` : part;
    if (candidate.length > max) {
      if (out === "") out = part;
      break;
    }
    out = candidate;
  }
  return out;
}

/** Last-resort truncation to `max` on a word boundary. Guarantees the budget
    holds even for a single part longer than the whole allowance. */
export function fitSerpText(text: string, max: number): string {
  if (text.length <= max) return text;
  const clipped = text.slice(0, Math.max(0, max - 1));
  const lastSpace = clipped.lastIndexOf(" ");
  const trimmed = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;
  return `${trimmed.replace(/[\s,;:—–-]+$/, "")}${SERP_ELLIPSIS}`;
}

/** True when `fitSerpText` had to cut the string — a content smell, since a
    truncated snippet in the SERP reads as broken rather than concise. */
export function isSerpTruncated(text: string): boolean {
  return text.endsWith(SERP_ELLIPSIS);
}

/** Fit a child page title: composed, then guaranteed to fit with the brand
    suffix the root layout appends. */
export function serpTitle(parts: readonly Part[]): string {
  return fitSerpText(composeSerpText(parts, SERP_TITLE_BUDGET), SERP_TITLE_BUDGET);
}

/** Fit a meta description. */
export function serpDescription(parts: readonly Part[]): string {
  return fitSerpText(composeSerpText(parts, SERP_DESCRIPTION_MAX), SERP_DESCRIPTION_MAX);
}

/** "1 active listing" / "3 active listings". */
function listingCount(n: number): string {
  return `${n} active listing${n === 1 ? "" : "s"}`;
}

/** Listing title: the editorial title when it fits, otherwise a formula built
    from the facts a searcher actually types.

    The formula is not a downgrade of the editorial title: for generated
    inventory the two say the same thing and only one of them fits. For
    hand-written listings ("A garden courtyard in Paldi") the editorial title
    is kept. */
export function listingSerpTitle(property: Property): string {
  const price = `— ${property.price}`;
  const editorial = serpTitle([property.title, price]);
  if (!isSerpTruncated(editorial)) return editorial;
  const formula = `${property.bhk} BHK ${property.transaction === "rent" ? "for rent" : "for sale"} in ${property.locality}`;
  return serpTitle([formula, price]);
}

/** Listing description, answer-first: configuration, area, place and price
    lead; the long narrative note is appended only if it still fits. */
export function listingSerpDescription(property: Property): string {
  return serpDescription([
    `${property.meta} · ${property.area} in ${property.locality}, ${property.city} — ${property.price}.`,
    `${property.badge}, ${property.status.toLowerCase()}.`,
    property.note ? `${property.note}` : null,
  ]);
}

export type LocalitySerpInput = {
  name: string;
  hindi?: string;
  note?: string;
  pincodes?: readonly string[];
  cityName: string;
  reraAuthority?: string;
  /** Aggregated facts, or undefined when the page has none. */
  intel?: LocalityIntel;
};

/** Locality title: place and city always; the tail clause is whatever fits. */
export function localitySerpTitle(input: LocalitySerpInput): string {
  return serpTitle([
    `${input.name}, ${input.cityName}`,
    "— homes & locality context",
    "— homes for sale",
    "— homes",
  ]);
}

/** Locality description, answer-first: the median and rate first when the
    sample supports them, the PIN and locality note next, boilerplate last.

    When the sample is below the publication bar no median is printed here
    either — see `price-trends.ts` for why. */
export function localitySerpDescription(input: LocalitySerpInput): string {
  const intel = input.intel;
  const published = intel?.sampleSufficient && intel.medianPriceInr !== null;
  const pin = input.pincodes?.[0];
  return serpDescription([
    `Homes in ${input.name}, ${input.cityName}${pin ? ` — PIN ${pin}` : ""}.`,
    published
      ? `Median ${compactInr(intel.medianPriceInr)}, ${formatPsf(intel.avgPricePerSqftInr)}/sq ft across ${listingCount(intel.buyCount)}.`
      : null,
    input.note ? `${input.note}.` : null,
    input.reraAuthority ? `${input.reraAuthority} context, verified coordinates, and real distances.` : null,
  ]);
}

export type CitySerpInput = {
  name: string;
  state?: string;
  reraAuthority?: string;
  /** Locality names to advertise, most prominent first. */
  localities?: readonly string[];
};

export function citySerpTitle(input: CitySerpInput): string {
  return serpTitle([
    `Buy in ${input.name}`,
    "— localities with verified context",
    "— localities",
    "— homes",
  ]);
}

export function citySerpDescription(input: CitySerpInput): string {
  const names = input.localities?.slice(0, 4) ?? [];
  return serpDescription([
    `Buy in ${input.name}${input.state ? `, ${input.state}` : ""}${names.length ? `: ${names.join(", ")}` : ""}.`,
    "Explore locality by locality with RERA context, verified coordinates, and real distances.",
  ]);
}
