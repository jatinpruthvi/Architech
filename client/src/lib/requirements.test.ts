import { describe, expect, it, beforeEach } from "vitest";
import { createRequirement, resetRequirementStoreForTests, validateRequirementInput } from "./requirements";
import { searchListings } from "./search/search";

describe("requirement capture", () => {
  beforeEach(() => resetRequirementStoreForTests());

  it("rejects incomplete contact and locality details", () => {
    expect(validateRequirementInput({ intent: "buy", city: "ahmedabad", category: "residential", subtype: "Flat/Apartment", role: "buyer", name: "A", phone: "123", localities: [], consentText: "" })).toEqual([
      "Choose at least one preferred locality.",
      "Name must be at least 2 characters.",
      "Phone must include at least 8 digits.",
      "Consent text is required.",
    ]);
  });

  it("masks the phone number and deduplicates repeated submissions", () => {
    const input = { intent: "buy" as const, city: "ahmedabad" as const, category: "residential" as const, subtype: "Flat/Apartment", localities: ["Paldi"], role: "buyer" as const, name: "Jatin", phone: "+91 98765 43210", consentText: "I agree that Architech may contact me about this requirement.", idempotencyKey: "req-test-1" };
    const first = createRequirement(input);
    const second = createRequirement(input);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.requirement.phoneMasked).toContain("3210");
      expect(first.duplicate).toBe(false);
      expect(second.duplicate).toBe(true);
      expect(second.requirement.id).toBe(first.requirement.id);
    }
  });
});

describe("market-aware search", () => {
  it("keeps category and intent in the response contract", () => {
    const response = searchListings({ category: "commercial", intent: "rent" });
    expect(response.category).toBe("commercial");
    expect(response.intent).toBe("rent");
    expect(response.results).toHaveLength(0);
  });
});
