import { beforeEach, describe, expect, it } from "vitest";
import { createRequirement, resetRequirementStoreForTests, validateRequirementInput } from "./requirements";
import { searchListings } from "./search/search";

const validInput = {
  intent: "buy" as const,
  citySlug: "ahmedabad",
  category: "residential" as const,
  subtype: "Flat/Apartment",
  localitySlugs: ["paldi"],
  role: "buyer" as const,
  name: "Jatin",
  phone: "+91 98765 43210",
  consentText: "I agree that Architech may contact me about this requirement.",
};

describe("requirement capture", () => {
  beforeEach(() => resetRequirementStoreForTests());

  it("rejects incomplete contact and locality details", () => {
    expect(validateRequirementInput({ ...validInput, name: "A", phone: "123", localitySlugs: [], consentText: "" })).toEqual([
      "Choose at least one preferred locality.",
      "Name must be at least 2 characters.",
      "Phone must include at least 8 digits.",
      "Consent text is required.",
    ]);
  });

  it("rejects phone numbers beyond the E.164 digit limit", () => {
    expect(validateRequirementInput({ ...validInput, phone: "+91 12345 67890 12345" })).toContain(
      "Phone must include no more than 15 digits.",
    );
  });

  it("rejects display names and cross-city locality slugs", () => {
    expect(validateRequirementInput({ ...validInput, localitySlugs: ["Paldi"] })).toContain(
      "Every preferred locality must belong to the selected city.",
    );
    expect(validateRequirementInput({ ...validInput, citySlug: "mumbai", localitySlugs: ["paldi"] })).toContain(
      "Every preferred locality must belong to the selected city.",
    );
  });

  it("accepts a locality only in its own city", () => {
    expect(validateRequirementInput({ ...validInput, citySlug: "mumbai", localitySlugs: ["bandra-west"] })).toEqual([]);
  });

  it("masks the phone number and deduplicates repeated submissions", () => {
    const input = { ...validInput, idempotencyKey: "req-test-1" };
    const first = createRequirement(input);
    const second = createRequirement(input);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.requirement.phoneMasked).toContain("3210");
      expect(first.requirement.localitySlugs).toEqual(["paldi"]);
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
