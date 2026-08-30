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

/** The richest tail clause that still fits beside `subject`, or null.

    `composeSerpText` appends parts in order and stops at the first that does
    not fit. That is right for clauses that *depend* on each other — a price
    with nothing it prices is noise — but wrong for variants competing for the
    same slot. Listing three tails of decreasing length there left two of them
    unreachable: the longest was tried, it overflowed, and the loop broke
    before the shorter ones were ever considered.

    Measured on the built corpus, 15 of 72 locality pages shipped a bare
    "Locality, City" title with up to 26 characters of budget unused, because
    the only tail long enough to be interesting was also too long to fit.

    Candidates are tried richest-first, so a short place name earns the
    specific clause and a long one degrades to a shorter truth. */
export function fitTail(subject: string, candidates: readonly Part[], max: number = SERP_TITLE_BUDGET): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (`${subject} ${candidate}`.length <= max) return candidate;
  }
  return null;
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

/** Locality title: place and city always; the tail clause is whatever fits.

    Contestant E §2 wants the number in the title — his template is
    `Flats in {Locality}, {City} — 1/2/3 BHK Price ₹{X}/sqft`. The template
    does not survive contact with the budget: it runs past 60 characters for
    most Indian place names. His *reason* does. A generic tail
    ("— homes & locality context") spends the one line that earns the click on
    something true of every page, while the configurations actually available
    and the rate per square foot are what a searcher is comparing on — and
    they differ page to page, which is the whole point of the page.

    So the tail is now a ladder of real facts, richest first, and `fitTail`
    picks the richest that fits: a short place name gets configuration and
    rate, a long one degrades to a shorter truth rather than to nothing. */
export function localitySerpTitle(input: LocalitySerpInput): string {
  const subject = `${input.name}, ${input.cityName}`;
  const intel = input.intel;
  const publishable = Boolean(intel?.sampleSufficient) && intel?.avgPricePerSqftInr != null;
  const psf = publishable ? formatPsf(intel!.avgPricePerSqftInr) : null;
  const bhk = intel?.byBhk?.length ? `${intel.byBhk.map((entry) => entry.bhk).join("/")} BHK` : null;
  return serpTitle([
    subject,
    fitTail(subject, [
      psf && bhk ? `— ${bhk}, ${psf}/sq ft` : null,
      psf ? `— ${psf}/sq ft` : null,
      "— homes & locality context",
      "— homes for sale",
      "— homes",
    ]),
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

/* Price-index SERP copy (contestant E §5).

   The report is the one asset that earns unsolicited links, so the snippet
   has to survive being pasted into someone else's article: it leads with the
   number, names the sample it came from, and states the month. A price index
   that does not say what it measured and when is not citable.

   The gated case matters as much as the publishable one. When the sample is
   too small the report is withheld for that city, and the snippet says so
   rather than blanking the page — the coverage gap is the story. */

export type PriceIndexSerpInput = {
  cityName: string;
  medianPriceInr: number | null;
  avgPricePerSqftInr: number | null;
  sampleSize: number;
  localityCount: number;
  asOfLabel: string;
  /** False when the report is withheld. `blockers` then says why. */
  publishable: boolean;
  /** The report's own reasons for being withheld, in its words.

      Carried through rather than re-derived: a city can clear the sample bar
      itself and still be withheld because no locality inside it does, and a
      snippet that guessed the wrong reason would publish a false statement
      about a page whose whole value is telling the truth about coverage. */
  blockers?: readonly string[];
};

export function priceIndexSerpTitle(input: PriceIndexSerpInput): string {
  const subject = `${input.cityName} property price index`;
  const psf = input.avgPricePerSqftInr === null ? null : formatPsf(input.avgPricePerSqftInr);
  const median = input.medianPriceInr === null ? null : compactInr(input.medianPriceInr);
  return serpTitle([
    subject,
    fitTail(subject, [
      input.publishable && psf ? `— ${psf}/sq ft` : null,
      input.publishable && median ? `— median ${median}` : null,
      input.publishable ? `— ${input.asOfLabel}` : null,
      `— ${input.asOfLabel}`,
    ]),
  ]);
}

export function priceIndexSerpDescription(input: PriceIndexSerpInput): string {
  return serpDescription([
    input.publishable
      ? `${input.cityName} price index, ${input.asOfLabel}: median ${compactInr(input.medianPriceInr)}, ${formatPsf(input.avgPricePerSqftInr)}/sq ft across ${input.sampleSize} sale listings in ${input.localityCount} localities.`
      : `${input.cityName} price index, ${input.asOfLabel}: withheld — ${input.blockers?.[0] ?? "the sample is below the publication bar"}.`,
    "The page states its coverage and every blocker.",
  ]);
}

export function priceIndexHubSerpTitle(): string {
  return serpTitle(["Property price index", "— Indian cities", "— India"]);
}

export function priceIndexHubSerpDescription(): string {
  return serpDescription([
    "Property price indexes for the Indian cities Architech covers: median price and rate per sq ft by city and locality.",
    "One page per city, with the sample behind every figure.",
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
