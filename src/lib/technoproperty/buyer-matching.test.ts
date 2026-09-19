import { describe, expect, it } from "vitest";
import {
  furnitureKind,
  parseBhk,
  rankMatches,
  scoreBuyerMatch,
  tierFor,
  type BuyerLeadInput,
  type MatchableListingInput,
} from "./buyer-matching";

/* The default fixture: a 2BHK rent seeker in Thaltej, ₹25,000/mo, furnished. */
const lead = (over: Partial<BuyerLeadInput> = {}): BuyerLeadInput => ({
  dealType: "RENT",
  bhk: 2,
  budgetValue: 25_000,
  area: "Thaltej",
  furniture: "Furnished",
  ...over,
});

const listing = (over: Partial<MatchableListingInput> = {}): MatchableListingInput => ({
  id: "p1",
  category: "RESIDENTIAL_RENT",
  keyInfo: "2BHK High Rise Apartment",
  availabilityRaw: null,
  area: "Thaltej",
  rentPriceValue: 22_000n,
  furnitureRaw: "Furnished",
  active: true,
  isRentedOut: false,
  soldOut: false,
  ...over,
});

describe("parseBhk", () => {
  it("reads the BHK tag from keyInfo", () => {
    expect(parseBhk("2BHK High Rise Apartment", null)).toBe(2);
    expect(parseBhk("3 bhk flat", null)).toBe(3);
    expect(parseBhk("2 BHK", null)).toBe(2);
  });
  it("falls back to availabilityRaw", () => {
    expect(parseBhk(null, "3BHK Apartment")).toBe(3);
    expect(parseBhk("Shop 400sqft", "2BHK")).toBe(2);
  });
  it("ignores non-BHK layouts", () => {
    expect(parseBhk("1RK Flat", null)).toBeNull();
    expect(parseBhk(null, null)).toBeNull();
  });
});

describe("furnitureKind", () => {
  it("normalises crawler spellings", () => {
    expect(furnitureKind("Semi-Furnished")).toBe("semi");
    expect(furnitureKind("semi furnished")).toBe("semi");
    expect(furnitureKind("Fully Furnished")).toBe("furnished");
    expect(furnitureKind("Unfurnished")).toBe("unfurnished");
    expect(furnitureKind(null)).toBe("unknown");
    expect(furnitureKind("Parking available")).toBe("unknown");
  });
  it("does not let 'unfurnished' match 'furnished'", () => {
    const r = scoreBuyerMatch(lead({ furniture: "Furnished" }), listing({ furnitureRaw: "Unfurnished" }));
    expect(r?.score).toBe(95); // 40 + 35 + 20 + 0
  });
});

describe("scoreBuyerMatch", () => {
  it("scores a perfect fit 100/strong with all-green reasons", () => {
    const r = scoreBuyerMatch(lead(), listing());
    expect(r?.score).toBe(100);
    expect(r?.tier).toBe("strong");
    expect(r?.reasons).toEqual([
      { text: "2BHK ✓", ok: true },
      { text: "₹22,000/mo ✓", ok: true },
      { text: "Thaltej ✓", ok: true },
      { text: "Furnished ✓", ok: true },
    ]);
  });

  it("gives half BHK credit to one size up (80 = strong boundary)", () => {
    const r = scoreBuyerMatch(lead(), listing({ keyInfo: "3BHK Apartment" }));
    expect(r?.score).toBe(80);
    expect(r?.tier).toBe("strong");
    expect(r?.reasons[0]).toEqual({ text: "3BHK — one up", ok: false });
  });

  it("scores a smaller BHK zero (60 = good boundary)", () => {
    expect(scoreBuyerMatch(lead(), listing({ keyInfo: "1BHK Flat" }))?.score).toBe(60);
    expect(scoreBuyerMatch(lead(), listing({ keyInfo: "1BHK Flat" }))?.tier).toBe("good");
  });

  it("scores a BHK two-up zero as well", () => {
    expect(scoreBuyerMatch(lead(), listing({ keyInfo: "4BHK Villa" }))?.score).toBe(60);
  });

  it("handles budget tiers: in / 10% / 20% / 50% over", () => {
    expect(scoreBuyerMatch(lead(), listing({ rentPriceValue: 26_250n }))?.score).toBe(90); // 5% over → 25
    expect(scoreBuyerMatch(lead(), listing({ rentPriceValue: 27_500n }))?.score).toBe(90); // 10% over → 25
    expect(scoreBuyerMatch(lead(), listing({ rentPriceValue: 30_000n }))?.score).toBe(80); // 20% over → 15
    const big = scoreBuyerMatch(lead(), listing({ rentPriceValue: 38_000n }));
    expect(big?.score).toBe(70); // 52% over → 5
    expect(big?.reasons[1]?.text).toBe("52% over budget");
  });

  it("reports small overages as rupees, big ones as percent", () => {
    expect(scoreBuyerMatch(lead(), listing({ rentPriceValue: 26_000n }))?.reasons[1]?.text).toBe("₹1,000/mo over budget");
  });

  it("credits a nearby (partial) area hit", () => {
    const r = scoreBuyerMatch(lead(), listing({ area: "Thaltej East" }));
    expect(r?.score).toBe(95);
    expect(r?.reasons[2]).toEqual({ text: "Thaltej East — nearby", ok: true });
  });

  it("scores a different area zero", () => {
    const r = scoreBuyerMatch(lead(), listing({ area: "Vasna" }));
    expect(r?.score).toBe(80); // carried by BHK + budget + furniture
    expect(r?.reasons[2]?.ok).toBe(false);
  });

  it("drops missing-data components gently", () => {
    // No BHK tag, no price, no area on the listing; buyer stated all three.
    const r = scoreBuyerMatch(lead(), listing({ keyInfo: "Flat", rentPriceValue: null, area: null }));
    expect(r?.score).toBe(15 + 15 + 5 + 5); // 40
    expect(r?.tier).toBe("possible");
  });

  it("treats 'Any' furniture as neutral", () => {
    expect(scoreBuyerMatch(lead({ furniture: "Any" }), listing({ furnitureRaw: null }))?.score).toBe(40 + 35 + 20 + 2);
  });

  it("scores a bare name-and-number lead at the neutral 50 (possible), no reasons", () => {
    const r = scoreBuyerMatch(
      lead({ bhk: null, budgetValue: null, area: null, furniture: null }),
      listing(),
    );
    expect(r?.score).toBe(50);
    expect(r?.tier).toBe("possible");
    expect(r?.reasons).toEqual([]);
  });

  it("uses total-rupee labels for sell deals (no /mo)", () => {
    const r = scoreBuyerMatch(
      lead({ dealType: "SELL", budgetValue: 5_000_000, furniture: null }),
      listing({ category: "RESIDENTIAL_SELL", rentPriceValue: 4_500_000n }),
    );
    expect(r?.reasons[1]?.text).toBe("₹45,00,000 ✓");
  });

  it("hard-excludes wrong deal kind, inactive, rented-out and sold listings", () => {
    expect(scoreBuyerMatch(lead({ dealType: "SELL" }), listing())).toBeNull();
    expect(scoreBuyerMatch(lead({ dealType: "RENT" }), listing({ category: "RESIDENTIAL_SELL" }))).toBeNull();
    expect(scoreBuyerMatch(lead(), listing({ active: false }))).toBeNull();
    expect(scoreBuyerMatch(lead(), listing({ isRentedOut: true }))).toBeNull();
    expect(scoreBuyerMatch(lead({ dealType: "SELL" }), listing({ category: "RESIDENTIAL_SELL", soldOut: true }))).toBeNull();
    // sold flag is stale for rent deals too
    expect(scoreBuyerMatch(lead(), listing({ soldOut: true }))).toBeNull();
  });
});

describe("tierFor", () => {
  it("applies the 80/60/40 boundaries", () => {
    expect(tierFor(100)).toBe("strong");
    expect(tierFor(80)).toBe("strong");
    expect(tierFor(79)).toBe("good");
    expect(tierFor(60)).toBe("good");
    expect(tierFor(59)).toBe("possible");
    expect(tierFor(40)).toBe("possible");
    expect(tierFor(39)).toBe("low");
  });
});

describe("rankMatches", () => {
  it("excludes, hides low tier, sorts by score and caps the list", () => {
    const pool: MatchableListingInput[] = [
      listing({ id: "perfect" }), // 100
      listing({ id: "mid", keyInfo: "3BHK", rentPriceValue: 30_000n, area: "Vasna" }), // 20+15+0+5=40 possible
      listing({ id: "rented", isRentedOut: true }), // excluded
      listing({ id: "low", keyInfo: "1BHK", rentPriceValue: 45_000n, area: "Vasna", furnitureRaw: "Unfurnished" }), // 0+5+0+0=5 low
      ...Array.from({ length: 5 }, (_, i) => listing({ id: `fill-${i}`, keyInfo: "1BHK", rentPriceValue: 45_000n, area: "Vasna", furnitureRaw: "Unfurnished" })),
    ];
    const ranked = rankMatches(lead(), pool, 24);
    expect(ranked.map((r) => r.listingId)).toEqual(["perfect", "mid"]);
    expect(ranked[0].tier).toBe("strong");
    expect(ranked[1].tier).toBe("possible");
  });

  it("caps at the requested size, keeping the best", () => {
    const pool = Array.from({ length: 30 }, (_, i) =>
      listing({ id: `l${i}`, rentPriceValue: 20_000n + BigInt(i * 100) }),
    );
    const ranked = rankMatches(lead(), pool, 10);
    expect(ranked).toHaveLength(10);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
    expect(ranked[0].listingId).toBe("l0");
  });
});
