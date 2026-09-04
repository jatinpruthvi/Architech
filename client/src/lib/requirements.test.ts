import { beforeEach, describe, expect, it } from "vitest";
import { createRequirement, intentLabel, requirementIdempotencyKey, intentsForRole, isSupplyIntent, resetRequirementStoreForTests, validateRequirementInput } from "./requirements";
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

describe("role decides what you can ask for", () => {
  beforeEach(() => resetRequirementStoreForTests());

  it("offers a buyer both demand-side options and no supply-side ones", () => {
    expect(intentsForRole("buyer")).toEqual(["buy", "rent"]);
  });

  it("offers a tenant only renting", () => {
    // A tenant does not sell, and did not previously have an honest option.
    expect(intentsForRole("tenant")).toEqual(["rent"]);
  });

  it("offers an owner the supply side, which the form used to omit entirely", () => {
    expect(intentsForRole("owner")).toEqual(["list_sale", "list_rent"]);
  });

  it("lets agents work both sides", () => {
    expect(intentsForRole("agent")).toEqual(["buy", "rent", "list_sale", "list_rent"]);
  });

  it("labels every intent in the person's own words", () => {
    expect(intentLabel("list_sale")).toBe("Sell my property");
    expect(intentLabel("list_rent")).toBe("Find a tenant");
    expect(intentLabel("buy")).toBe("Buy a place");
    expect(intentLabel("rent")).toBe("Rent a place");
  });

  it("knows which intents describe a property the person already has", () => {
    expect(isSupplyIntent("list_sale")).toBe(true);
    expect(isSupplyIntent("list_rent")).toBe(true);
    expect(isSupplyIntent("buy")).toBe(false);
  });

  it("rejects a role and intent that contradict each other", () => {
    /* Otherwise the API records a tenant who is selling a flat, which no
       downstream consumer can interpret. */
    expect(validateRequirementInput({ ...validInput, role: "tenant", intent: "list_sale" })).toContain(
      "That option does not match the role you selected.",
    );
  });

  it("accepts an owner selling their own property", () => {
    expect(validateRequirementInput({ ...validInput, role: "owner", intent: "list_sale" })).toEqual([]);
  });

  it("accepts a landlord looking for a tenant", () => {
    expect(validateRequirementInput({ ...validInput, role: "owner", intent: "list_rent" })).toEqual([]);
  });
});

describe("localities are a preference when buying and a fact when listing", () => {
  beforeEach(() => resetRequirementStoreForTests());

  it("lets a buyer name several areas", () => {
    expect(validateRequirementInput({ ...validInput, localitySlugs: ["paldi", "thaltej", "bopal"] })).toEqual([]);
  });

  it("refuses several areas for one property being listed", () => {
    // A flat has one address; recording three would make the record untrue.
    expect(validateRequirementInput({
      ...validInput, role: "owner", intent: "list_sale", localitySlugs: ["paldi", "thaltej"],
    })).toContain("A property can only be in one locality. Choose the one it is in.");
  });

  it("accepts exactly one area for a property being listed", () => {
    expect(validateRequirementInput({
      ...validInput, role: "owner", intent: "list_sale", localitySlugs: ["paldi"],
    })).toEqual([]);
  });

  it("asks a lister where the property IS, not where they prefer", () => {
    expect(validateRequirementInput({
      ...validInput, role: "owner", intent: "list_sale", localitySlugs: [],
    })).toContain("Choose the locality your property is in.");
  });

  it("still caps a buyer's preference list", () => {
    const many = ["paldi", "thaltej", "bopal", "satellite", "navrangpura", "prahlad-nagar"];
    expect(validateRequirementInput({ ...validInput, localitySlugs: [...many, ...many, ...many] }).join(" "))
      .toMatch(/no more than 8 preferred localities/);
  });
});

describe("the idempotency key does not leak the phone number", () => {
  const brief = {
    intent: "buy" as const,
    citySlug: "mumbai",
    category: "residential" as const,
    subtype: "Flat/Apartment",
    localitySlugs: ["andheri-west"],
    role: "buyer" as const,
    name: "Test Person",
    phone: "9876543210",
    consentText: "I agree to be contacted about this requirement.",
  };

  it("never embeds the digits of the phone number", () => {
    /* The key is persisted and echoed back to the browser. Putting a
       plaintext number in it defeats the encrypted phone column entirely. */
    const key = requirementIdempotencyKey(brief);
    expect(key).not.toContain("9876543210");
    expect(key).not.toMatch(/\d{6,}/);
  });

  it("is stable for the same brief and different for a different one", () => {
    expect(requirementIdempotencyKey(brief)).toBe(requirementIdempotencyKey({ ...brief }));
    expect(requirementIdempotencyKey(brief)).not.toBe(requirementIdempotencyKey({ ...brief, phone: "9876543211" }));
    expect(requirementIdempotencyKey(brief)).not.toBe(requirementIdempotencyKey({ ...brief, citySlug: "pune" }));
  });

  it("separates two accounts that share one phone number", () => {
    const parent = requirementIdempotencyKey({ ...brief, userId: "user-parent" });
    const child = requirementIdempotencyKey({ ...brief, userId: "user-child" });
    expect(parent).not.toBe(child);
    /* ...and neither collides with the anonymous form of the same brief. */
    expect(parent).not.toBe(requirementIdempotencyKey(brief));
  });

  it("still honours an explicitly supplied key", () => {
    expect(requirementIdempotencyKey({ ...brief, idempotencyKey: "caller-supplied" })).toBe("caller-supplied");
  });
});
