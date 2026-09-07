/* Transaction intent as a first-class SEO dimension.
 *
 * Why this module exists: `urls.ts` has accepted `intent: "buy" | "rent"` since
 * the URL helpers were written, but nothing ever passed "rent". There was no
 * `/rent/` route, no rent page in the registry, and `/rent/ahmedabad/` returned
 * 404. Meanwhile `Listing.transactionType` did not exist as a column at all, so
 * every listing mapped to "buy" (fixed by migration 202609070002).
 *
 * The result was that roughly half of Indian property search intent — renting —
 * had no addressable surface. "2 bhk for rent in bopal" and "2 bhk in bopal"
 * are different queries with different intent, different price semantics
 * (monthly vs capital), and in a competitive market they are answered by
 * different pages. Collapsing them onto one URL means ranking well for neither.
 *
 * This module centralises what differs between the two so the routes stay thin
 * and cannot drift apart in wording, schema, or breadcrumb shape. It is
 * deliberately data, not logic: a page that needs to know "what does rent call
 * its price?" asks here rather than inlining a ternary.
 *
 * Pure: no clock, no I/O, no request. */

export type TransactionIntent = "buy" | "rent";

export const TRANSACTION_INTENTS: readonly TransactionIntent[] = ["buy", "rent"];

export function isTransactionIntent(value: string): value is TransactionIntent {
  return value === "buy" || value === "rent";
}

export type IntentVocabulary = {
  intent: TransactionIntent;
  /** URL segment. Also the registry id prefix, so ids stay greppable. */
  segment: string;
  /** Verb for headings: "Buy in Ahmedabad" / "Rent in Ahmedabad". */
  verb: string;
  /** Sentence-case label for breadcrumbs and link text. */
  label: string;
  /** Breadcrumb label for the intent hub (/buy/, /rent/). Distinct per intent:
      a shared "Cities" told a person mid-trail nothing about which branch they
      were in, and read identically on both trees. */
  hubLabel: string;
  /** How price reads for this intent. Rent is a recurring monthly amount and
      must never be described with buy's capital-sum language. */
  priceNoun: string;
  /** schema.org offer shape. A rental is a lease, not a sale — using the same
      Offer for both tells an aggregator a ₹22,000 flat is for sale. */
  businessFunction: string;
  /** The query shape this intent's pages are the answer to, used by the
      registry's `targetQuery` so a miss is measurable. */
  queryTemplate: (place: string) => string;
};

const VOCABULARY: Record<TransactionIntent, IntentVocabulary> = {
  buy: {
    intent: "buy",
    segment: "buy",
    verb: "Buy",
    label: "Buy",
    hubLabel: "Buy",
    priceNoun: "asking price",
    /* http://purl.org/goodrelations/v1#Sell — the schema.org-endorsed
       GoodRelations vocabulary for "this offer transfers ownership". */
    businessFunction: "http://purl.org/goodrelations/v1#Sell",
    queryTemplate: (place) => `property for sale in ${place}`,
  },
  rent: {
    intent: "rent",
    segment: "rent",
    verb: "Rent",
    label: "Rent",
    hubLabel: "Rent",
    priceNoun: "monthly rent",
    /* LeaseOut, not Sell: the distinction a property aggregator needs to
       avoid listing a rental at its monthly figure as a sale price. */
    businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
    queryTemplate: (place) => `property for rent in ${place}`,
  },
};

export function intentVocabulary(intent: TransactionIntent): IntentVocabulary {
  return VOCABULARY[intent];
}

/** The opposite intent — for the cross-link every intent page carries.
 *
 *  This link is not decoration. A user on the rent page for Bopal who actually
 *  wants to buy needs one click, and the link gives each page an inbound
 *  internal link from a closely-related page, which is how the pair gets
 *  crawled and understood as siblings rather than duplicates. */
export function oppositeIntent(intent: TransactionIntent): TransactionIntent {
  return intent === "buy" ? "rent" : "buy";
}
