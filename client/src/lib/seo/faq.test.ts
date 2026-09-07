import { describe, expect, it } from "vitest";
import { buildFaqPage, localityFaqEntries, type LocalityFaqFacts } from "./faq";

/* The contract that matters: FAQ markup describes content the page actually
   shows, and a locality with no facts produces no FAQ at all. These tests
   exist to catch the two failure modes that get sites penalised — marking up
   answers that are not visible, and templating one FAQ across every page. */

const RICH: LocalityFaqFacts = {
  localityName: "Bopal",
  cityName: "Ahmedabad",
  stateName: "Gujarat",
  reraAuthority: "GujRERA",
  pincodes: ["380058"],
  landmarks: ["Bopal Lake", "Ahmedabad Metro"],
  saleCount: 3,
  rentCount: 2,
  medianPriceLabel: "₹1.2 Cr",
  asOfDate: "2026-08-26",
};

const BARE: LocalityFaqFacts = {
  localityName: "Nowhere",
  cityName: "Ahmedabad",
  stateName: "Gujarat",
  reraAuthority: "GujRERA",
  pincodes: [],
  saleCount: 0,
  rentCount: 0,
  medianPriceLabel: null,
};

describe("buildFaqPage", () => {
  it("emits a FAQPage with one Question per entry", () => {
    const node = buildFaqPage([
      { question: "A?", answer: "Yes." },
      { question: "B?", answer: "No." },
    ]);
    expect(node?.["@type"]).toBe("FAQPage");
    expect(node?.mainEntity).toHaveLength(2);
    expect(node?.mainEntity[0]).toEqual({
      "@type": "Question",
      name: "A?",
      acceptedAnswer: { "@type": "Answer", text: "Yes." },
    });
  });

  it("returns null below the useful minimum", () => {
    // A one-question FAQPage is not a rich-result candidate, just bytes.
    expect(buildFaqPage([{ question: "A?", answer: "Yes." }])).toBeNull();
    expect(buildFaqPage([])).toBeNull();
  });

  it("drops blank entries before counting", () => {
    expect(buildFaqPage([{ question: "A?", answer: "Yes." }, { question: "  ", answer: "x" }])).toBeNull();
  });

  it("carries the page url when given one", () => {
    const node = buildFaqPage([{ question: "A?", answer: "1" }, { question: "B?", answer: "2" }], "https://x.test/p/");
    expect(node?.url).toBe("https://x.test/p/");
  });
});

describe("locality FAQ generation", () => {
  it("answers PIN, availability, price, character, and RERA when facts exist", () => {
    const questions = localityFaqEntries(RICH).map((entry) => entry.question);
    expect(questions).toEqual([
      "What is the PIN code of Bopal, Ahmedabad?",
      "How many properties are available in Bopal, Ahmedabad?",
      "What is the average property price in Bopal, Ahmedabad?",
      "What is Bopal known for?",
      "Are Bopal properties RERA verified?",
    ]);
  });

  it("produces too few entries to publish for a locality with no facts", () => {
    /* The anti-doorway guarantee: a bare registry entry yields only the
       generic RERA answer, which is below buildFaqPage's floor, so the page
       emits no FAQPage at all rather than a templated one. */
    const entries = localityFaqEntries(BARE);
    expect(entries).toHaveLength(1);
    expect(buildFaqPage(entries)).toBeNull();
  });

  it("states availability honestly and omits the question at zero", () => {
    const none = localityFaqEntries({ ...RICH, saleCount: 0, rentCount: 0 });
    expect(none.map((entry) => entry.question)).not.toContain("How many properties are available in Bopal, Ahmedabad?");
  });

  it("counts sale and rent separately in the availability answer", () => {
    const answer = localityFaqEntries(RICH).find((entry) => entry.question.startsWith("How many"))?.answer ?? "";
    expect(answer).toContain("3 homes for sale");
    expect(answer).toContain("2 homes to rent");
  });

  it("uses singular wording for a single listing", () => {
    const answer = localityFaqEntries({ ...RICH, saleCount: 1, rentCount: 0 }).find((e) => e.question.startsWith("How many"))?.answer ?? "";
    expect(answer).toContain("1 home for sale");
    expect(answer).not.toContain("homes");
  });

  it("explains that a locality may span several PIN codes", () => {
    const answer = localityFaqEntries({ ...RICH, pincodes: ["380058", "380059"] }).find((e) => e.question.startsWith("What is the PIN"))?.answer ?? "";
    expect(answer).toContain("380058, 380059");
    expect(answer).toContain("postal delivery area");
  });

  it("never claims a RERA status it cannot verify", () => {
    // The answer must describe the checking policy, not assert registration.
    const answer = localityFaqEntries(RICH).find((entry) => entry.question.includes("RERA"))?.answer ?? "";
    expect(answer).toContain("GujRERA");
    expect(answer).toContain("marked as unverified");
    expect(answer).toContain("never infers");
  });

  it("qualifies the price answer as asking-price median, not a transaction index", () => {
    const answer = localityFaqEntries(RICH).find((entry) => entry.question.startsWith("What is the average"))?.answer ?? "";
    expect(answer).toContain("median");
    expect(answer).toContain("not a transaction-price index");
  });

  it("omits the price question when no median is derivable", () => {
    const questions = localityFaqEntries({ ...RICH, medianPriceLabel: null }).map((entry) => entry.question);
    expect(questions.some((question) => question.startsWith("What is the average"))).toBe(false);
  });
});
