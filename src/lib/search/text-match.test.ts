import { describe, expect, it } from "vitest";
import { bestMatch, editDistanceWithin, fold, matchQuality, typoBudget } from "./text-match";

describe("bounded edit distance", () => {
  it("measures small edits", () => {
    expect(editDistanceWithin("paldi", "paldi", 2)).toBe(0);
    expect(editDistanceWithin("paldi", "paldy", 2)).toBe(1);
    expect(editDistanceWithin("koramangla", "koramangala", 2)).toBe(1);
  });

  it("counts a transposition as one edit, not two", () => {
    expect(editDistanceWithin("whitefeild", "whitefield", 1)).toBe(1);
  });

  it("abandons early when the words are nothing alike", () => {
    expect(editDistanceWithin("bopal", "piplod", 1)).toBeNull();
    expect(editDistanceWithin("a", "abcdefgh", 2)).toBeNull();
  });
});

describe("typo budget", () => {
  it("gives short words no tolerance at all", () => {
    // At three characters nearly every other short word is one edit away.
    expect(typoBudget(3)).toBe(0);
    expect(typoBudget(4)).toBe(0);
    expect(typoBudget(6)).toBe(1);
    expect(typoBudget(11)).toBe(2);
  });
});

describe("match quality", () => {
  it("ranks exact above prefix above word-prefix above substring", () => {
    const exact = matchQuality("Pal", "pal")!;
    const prefix = matchQuality("Paldi", "pal")!;
    const wordPrefix = matchQuality("Prahlad Nagar", "nagar")!;
    const substring = matchQuality("Piplod", "plo")!;
    expect(exact.quality).toBe("exact");
    expect(prefix.quality).toBe("prefix");
    expect(wordPrefix.quality).toBe("word-prefix");
    expect(substring.quality).toBe("substring");
    expect(exact.score).toBeGreaterThan(prefix.score);
    expect(prefix.score).toBeGreaterThan(wordPrefix.score);
    expect(wordPrefix.score).toBeGreaterThan(substring.score);
  });

  it("scores a typo below every literal match", () => {
    const fuzzy = matchQuality("Koramangala", "koramangla")!;
    expect(fuzzy.quality).toBe("fuzzy");
    expect(fuzzy.score).toBeLessThan(matchQuality("Piplod", "plo")!.score);
  });

  it("returns null rather than a weak guess", () => {
    expect(matchQuality("Bopal", "piplod")).toBeNull();
    expect(matchQuality("Whitefield", "")).toBeNull();
  });

  it("folds Devanagari and Latin to the same form", () => {
    expect(fold("पालडी")).toBe(fold("Paldi").replace("paldi", "paldee"));
    expect(matchQuality("पालडी", "पालडी")?.quality).toBe("exact");
  });

  it("takes the best score across an entity's labels", () => {
    const result = bestMatch(["Paldi", "पालडी", "paldi"], "पालडी");
    expect(result?.quality).toBe("exact");
    expect(bestMatch(["Paldi", "पालडी"], "zzzz")).toBeNull();
  });
});
