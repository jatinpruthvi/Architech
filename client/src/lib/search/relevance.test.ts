import { describe, expect, it } from "vitest";
import { rankByRelevance, relevanceScore, RELEVANCE_WEIGHTS } from "./relevance";

const item = (over: Partial<Parameters<typeof relevanceScore>[0]> & { id: string }) => ({
  title: "",
  description: "",
  locality: "",
  city: "",
  availability: null,
  ...over,
});

describe("relevanceScore", () => {
  it("scores a title hit above a description hit (A outranks B)", () => {
    const inTitle = relevanceScore(item({ id: "a", title: "Garden Court" }), ["garden"]);
    const inDescription = relevanceScore(item({ id: "b", description: "Garden Court" }), ["garden"]);
    expect(inTitle).toBeGreaterThan(inDescription);
    expect(RELEVANCE_WEIGHTS.A).toBeGreaterThan(RELEVANCE_WEIGHTS.B);
  });

  it("is linear in term frequency, mirroring ts_rank_cd", () => {
    /* This is the property a boolean/max scorer gets WRONG, and the live
       parity matrix caught it: Postgres scores three occurrences 3x one. */
    const once = relevanceScore(item({ id: "a", title: "Garden flat" }), ["garden"]);
    const thrice = relevanceScore(item({ id: "b", title: "Garden garden garden" }), ["garden"]);
    expect(thrice).toBeCloseTo(once * 3, 6);
  });

  it("prefers a whole-word hit over a substring hit", () => {
    const whole = relevanceScore(item({ id: "a", title: "Garden Court" }), ["garden"]);
    const partial = relevanceScore(item({ id: "b", title: "Gardenia Court" }), ["garden"]);
    expect(whole).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(0); // still findable
  });

  it("rewards covering more of the query (cover density)", () => {
    const both = relevanceScore(item({ id: "a", title: "Garden Courtyard" }), ["garden", "courtyard"]);
    const one = relevanceScore(item({ id: "b", title: "Garden Garden" }), ["garden", "courtyard"]);
    expect(both).toBeGreaterThan(one);
  });

  it("folds case, accents and Devanagari like the rest of search", () => {
    expect(relevanceScore(item({ id: "a", title: "Paldi" }), ["pāldi"])).toBeGreaterThan(0);
    expect(relevanceScore(item({ id: "b", title: "PALDI" }), ["paldi"])).toBeGreaterThan(0);
  });

  it("scores zero when nothing matches, and for an empty query", () => {
    expect(relevanceScore(item({ id: "a", title: "Garden" }), ["thaltej"])).toBe(0);
    expect(relevanceScore(item({ id: "a", title: "Garden" }), [])).toBe(0);
  });
});

describe("rankByRelevance", () => {
  it("puts the strongest match first regardless of input order", () => {
    const list = [
      item({ id: "weak", title: "Modern flat", description: "a garden nearby" }),
      item({ id: "strong", title: "Garden Court garden garden" }),
      item({ id: "mid", title: "Garden view" }),
    ];
    expect(rankByRelevance(list, "garden").map((entry) => entry.id)).toEqual(["strong", "mid", "weak"]);
  });

  it("returns the input order untouched when the query has no residual tokens", () => {
    /* "3 bhk" is fully structured — parse-query turns it into filters, so
       there is no text to rank against. Inventing an order there would be
       dishonest; the freshest-first read order stands. */
    const list = [item({ id: "a", title: "One" }), item({ id: "b", title: "Two" })];
    expect(rankByRelevance(list, "3 bhk").map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(rankByRelevance(list, "").map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("breaks ties on input (fresh) order, then id — a total, stable order", () => {
    const list = [item({ id: "b", title: "Garden" }), item({ id: "a", title: "Garden" })];
    // Equal scores: input order wins, so "b" stays ahead of "a".
    expect(rankByRelevance(list, "garden").map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("does not mutate the caller's array", () => {
    const list = [item({ id: "a", title: "x" }), item({ id: "b", title: "Garden" })];
    const before = list.map((entry) => entry.id);
    rankByRelevance(list, "garden");
    expect(list.map((entry) => entry.id)).toEqual(before);
  });
});
