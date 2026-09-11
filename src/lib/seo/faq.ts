/* FAQPage structured data.
 *
 * Why this module exists: the About page already renders four real questions
 * and answers as `<details>` elements, and the locality pages answer obvious
 * per-place questions in prose — but nothing emitted `FAQPage` schema, so none
 * of it was eligible for the FAQ rich result. That is free SERP real estate
 * competitors routinely take.
 *
 * The rule this module enforces, and the reason it is a module rather than an
 * inline object: **Google requires FAQ schema to describe content VISIBLE on
 * the page.** Marking up answers the user cannot see is a structured-data
 * violation and a manual-action risk. So `buildFaqPage` takes the SAME array
 * the component renders — one source, no possibility of the schema and the
 * page disagreeing. A caller cannot pass "extra" questions for the crawler
 * without also rendering them, because there is nowhere to put them.
 *
 * Locality FAQs are generated from real per-locality facts (PIN codes,
 * landmarks, live rental/sale counts) and every generator returns `null` when
 * the underlying fact is missing, so a place with no data contributes no
 * question rather than a templated non-answer. A locality FAQ that says
 * "prices in X vary" on 72 pages is a doorway signal, not a rich result.
 *
 * Pure: no clock, no I/O, no request. */

export type FaqEntry = {
  question: string;
  /** Plain text. Kept as text rather than HTML because the JSON-LD
      `acceptedAnswer.text` is compared against rendered copy, and smuggling
      markup in is how the two drift. */
  answer: string;
};

/** schema.org FAQPage node, ready to drop into an `@graph`.
 *
 *  Returns null below the minimum useful size: a one-question FAQPage is not a
 *  rich-result candidate and just adds bytes. Two is the practical floor. */
export function buildFaqPage(entries: readonly FaqEntry[], url?: string) {
  const usable = entries.filter((entry) => entry.question.trim() && entry.answer.trim());
  if (usable.length < 2) return null;
  return {
    "@type": "FAQPage" as const,
    ...(url ? { url } : {}),
    mainEntity: usable.map((entry) => ({
      "@type": "Question" as const,
      name: entry.question,
      acceptedAnswer: { "@type": "Answer" as const, text: entry.answer },
    })),
  };
}

export type LocalityFaqFacts = {
  localityName: string;
  cityName: string;
  stateName: string;
  reraAuthority: string;
  pincodes: readonly string[];
  landmarks?: readonly string[];
  /** Live, indexable counts — used only to answer "what is available here?".
      Zero is a legitimate answer and is stated honestly. */
  saleCount: number;
  rentCount: number;
  /** Median asking price, already formatted, or null when not derivable.
      On a rent page this MUST be a monthly rent figure, never a sale price —
      see `intent`. */
  medianPriceLabel?: string | null;
  /** Which surface is asking. Controls price wording: a rent page must not ask
      "what is the average property price", because the honest answer there is
      a monthly rent and conflating the two is exactly the error that makes an
      aggregator read ₹22,000/month as a sale price. Defaults to "buy" so
      existing callers are unaffected. */
  intent?: "buy" | "rent";
  /** ISO date the aggregated facts were computed. */
  asOfDate?: string;
};

/** Questions a locality page can genuinely answer from its own data.
 *
 *  Every entry is conditional. The output length therefore varies by place,
 *  which is the point: a locality with landmarks and PINs and inventory earns
 *  four questions, a bare registry entry earns none and gets no FAQPage at
 *  all. That difference is what keeps this from being template spam. */
export function localityFaqEntries(facts: LocalityFaqFacts): FaqEntry[] {
  const { localityName, cityName, stateName } = facts;
  const place = `${localityName}, ${cityName}`;
  const entries: FaqEntry[] = [];

  if (facts.pincodes.length) {
    entries.push({
      question: `What is the PIN code of ${place}?`,
      answer:
        facts.pincodes.length === 1
          ? `${localityName} is served by PIN code ${facts.pincodes[0]}. A PIN code is a postal delivery area, so its boundary does not always match the locality boundary exactly.`
          : `${localityName} is served by PIN codes ${facts.pincodes.join(", ")}. A locality can span several PIN codes because a PIN describes a postal delivery area rather than a neighbourhood boundary.`,
    });
  }

  /* Availability. Stated as a fact with its own date, and honest about zero —
     "no verified listings yet" is a real answer and a trust signal. */
  const total = facts.saleCount + facts.rentCount;
  if (total > 0) {
    const parts: string[] = [];
    if (facts.saleCount) parts.push(`${facts.saleCount} ${facts.saleCount === 1 ? "home" : "homes"} for sale`);
    if (facts.rentCount) parts.push(`${facts.rentCount} ${facts.rentCount === 1 ? "home" : "homes"} to rent`);
    entries.push({
      question: `How many properties are available in ${place}?`,
      answer: `Architech currently lists ${parts.join(" and ")} in ${localityName}${
        facts.asOfDate ? `, as of ${facts.asOfDate}` : ""
      }. Every listing carries its source and the date its facts were last checked.`,
    });
  }

  if (facts.medianPriceLabel) {
    const isRent = facts.intent === "rent";
    entries.push({
      question: isRent
        ? `What is the average rent in ${place}?`
        : `What is the average property price in ${place}?`,
      answer: isRent
        ? `The median asking rent across Architech's verified ${localityName} rental listings is ${facts.medianPriceLabel}${
            facts.asOfDate ? ` (as of ${facts.asOfDate})` : ""
          }. This is a median of monthly asking rents on this site, not a transaction-price index, and it excludes deposit, maintenance, and brokerage.`
        : `The median asking price across Architech's verified ${localityName} listings is ${facts.medianPriceLabel}${
            facts.asOfDate ? ` (as of ${facts.asOfDate})` : ""
          }. This is a median of asking prices on this site, not a transaction-price index, and it moves as inventory changes.`,
    });
  }

  if (facts.landmarks?.length) {
    entries.push({
      question: `What is ${localityName} known for?`,
      answer: `${localityName} is a locality in ${cityName}, ${stateName}. Nearby reference points include ${facts.landmarks
        .slice(0, 4)
        .join(", ")}.`,
    });
  }

  entries.push({
    question: `Are ${localityName} properties RERA verified?`,
    answer: `Listings in ${localityName} are checked against ${facts.reraAuthority} records where a registration number is available. Where it is not, the listing is marked as unverified rather than presented as registered — Architech never infers a RERA status.`,
  });

  return entries;
}
