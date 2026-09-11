/* Declared query targeting.

   Every listing states the query it is the answer to. Not as an aspiration —
   as data.

   The reason this exists is a single sentence from the design doc: you cannot
   tell whether a page achieved its query if you never recorded the query.
   Without a declaration, the only way to judge a listing page is to look at
   impressions after the fact and guess what it was aiming at, which is
   unfalsifiable. Record the intent and the outcome becomes measurable, and a
   page that misses can be retargeted rather than merely tolerated.

   The shape is fixed:

       {locality} + {bhk} + {transaction} + {entity name}
       "3 BHK apartment for sale in Paldi, Ahmedabad — A garden courtyard in Paldi"

   The locality carries the volume; the BHK and transaction carry the intent;
   the entity name is what makes it this page and not a template. A listing
   targeting "property in Ahmedabad" is targeting a query it cannot win, so the
   declaration is also a design constraint on what gets listed at all.

   It is derived, not authored — computed from fields the listing already has.
   Authored targeting drifts from the page it describes; derived targeting
   cannot. */
import type { Property } from "@/lib/repositories";

const TYPE_LABEL: Record<Property["propertyType"], string> = {
  APARTMENT: "apartment",
  ROWHOUSE: "rowhouse",
  VILLA: "villa",
  PENTHOUSE: "penthouse",
  PLOT: "plot",
};

export type ListingTargetQuery = {
  /** The full declared query. This is the string measurement is keyed on. */
  text: string;
  locality: string;
  city: string;
  bhk: number;
  transaction: Property["transaction"];
  /** The terms a SERP title must carry to be answering this query. */
  requiredTokens: string[];
};

export function listingTargetQuery(property: Property): ListingTargetQuery {
  const transactionWord = property.transaction === "rent" ? "rent" : "sale";
  const typeWord = TYPE_LABEL[property.propertyType] ?? "property";
  const head = `${property.bhk} BHK ${typeWord} for ${transactionWord} in ${property.locality}, ${property.city}`;

  return {
    text: `${head} — ${property.title}`,
    locality: property.locality,
    city: property.city,
    bhk: property.bhk,
    transaction: property.transaction,
    // Deliberately not the whole head. The title has ~48 characters of budget
    // before the brand suffix; requiring every word would fail every listing
    // and the check would be ignored. These are the terms whose absence means
    // the page is answering a different query.
    requiredTokens: [`${property.bhk} bhk`, transactionWord, property.locality.toLowerCase()],
  };
}

export type TitleCoverage = {
  covered: string[];
  missing: string[];
  /** True when every required term is present. */
  answers: boolean;
};

/** Whether a SERP title actually answers the declared query.

    `serp.ts` fits a title to a character budget, and `listingSerpTitle`
    degrades a too-long editorial title to a formula. Neither knows what the
    title was supposed to achieve. This closes that gap: it is the difference
    between "the title fits" and "the title fits and is about the right
    thing". */
export function serpTitleCoversQuery(title: string, query: ListingTargetQuery): TitleCoverage {
  const haystack = title.toLowerCase();
  const covered: string[] = [];
  const missing: string[] = [];

  for (const token of query.requiredTokens) {
    if (haystack.includes(token.toLowerCase())) covered.push(token);
    else missing.push(token);
  }

  return { covered, missing, answers: missing.length === 0 };
}
