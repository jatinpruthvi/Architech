import { describe, expect, it } from "vitest";
import { TRANSACTION_INTENTS, intentVocabulary, isTransactionIntent, oppositeIntent } from "./intent";
import { cityPath, cityUrl, localityPath, localityUrl } from "./urls";

/* The contract that matters: buy and rent are distinct, addressable surfaces
   with distinct URLs and distinct offer semantics. These tests exist to catch
   the collapse — a rent URL that resolves to the buy path, or a rental
   described with sale language. */

describe("intent vocabulary", () => {
  it("covers exactly buy and rent", () => {
    expect([...TRANSACTION_INTENTS]).toEqual(["buy", "rent"]);
  });

  it("narrows a string safely", () => {
    expect(isTransactionIntent("rent")).toBe(true);
    expect(isTransactionIntent("lease")).toBe(false);
    expect(isTransactionIntent("")).toBe(false);
  });

  it("pairs each intent with its opposite", () => {
    expect(oppositeIntent("buy")).toBe("rent");
    expect(oppositeIntent("rent")).toBe("buy");
  });

  it("describes rent as a recurring amount and buy as a capital one", () => {
    // A rental page must never inherit sale price language.
    expect(intentVocabulary("rent").priceNoun).toBe("monthly rent");
    expect(intentVocabulary("buy").priceNoun).toBe("asking price");
  });

  it("uses LeaseOut for rent and Sell for buy", () => {
    /* The distinction that stops an aggregator reading a ₹22,000 monthly
       figure as a sale price. */
    expect(intentVocabulary("rent").businessFunction).toContain("LeaseOut");
    expect(intentVocabulary("buy").businessFunction).toContain("Sell");
  });

  it("targets a different query per intent", () => {
    expect(intentVocabulary("rent").queryTemplate("Bopal")).toBe("property for rent in Bopal");
    expect(intentVocabulary("buy").queryTemplate("Bopal")).toBe("property for sale in Bopal");
  });
});

describe("intent-scoped URLs", () => {
  it("gives each intent its own city path", () => {
    expect(cityPath("ahmedabad", "buy")).toBe("/buy/ahmedabad/");
    expect(cityPath("ahmedabad", "rent")).toBe("/rent/ahmedabad/");
  });

  it("gives each intent its own locality path", () => {
    expect(localityPath("ahmedabad", "bopal", "buy")).toBe("/buy/ahmedabad/bopal/");
    expect(localityPath("ahmedabad", "bopal", "rent")).toBe("/rent/ahmedabad/bopal/");
  });

  it("defaults to buy so existing callers are unaffected", () => {
    // The intent parameter was added to helpers that already had callers.
    expect(cityPath("ahmedabad")).toBe(cityPath("ahmedabad", "buy"));
    expect(localityPath("ahmedabad", "bopal")).toBe(localityPath("ahmedabad", "bopal", "buy"));
  });

  it("never collapses the two intents onto one canonical URL", () => {
    /* The failure this whole split exists to prevent: one URL cannot be the
       canonical answer to both "for sale" and "for rent". */
    expect(cityUrl("ahmedabad", "rent")).not.toBe(cityUrl("ahmedabad", "buy"));
    expect(localityUrl("ahmedabad", "bopal", "rent")).not.toBe(localityUrl("ahmedabad", "bopal", "buy"));
  });

  it("keeps the trailing-slash policy on both intents", () => {
    for (const intent of TRANSACTION_INTENTS) {
      expect(cityPath("ahmedabad", intent).endsWith("/")).toBe(true);
      expect(localityPath("ahmedabad", "bopal", intent).endsWith("/")).toBe(true);
    }
  });
});
