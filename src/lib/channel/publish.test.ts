import { describe, expect, it } from "vitest";
import {
  checkDemandPublish,
  checkSupplyPublish,
  counterpartyContact,
  findContactDetails,
  isConnected,
  isTradeableOrganization,
  supplySearchFieldsFromListing,
  type ListingSnapshot,
  type OrganizationSnapshot,
} from "./publish";

const org = (over: Partial<OrganizationSnapshot> = {}): OrganizationSnapshot => ({
  id: "org_seller",
  name: "Skyline Realty",
  verificationStatus: "RERA_VERIFIED",
  businessPhoneE164: "+919876543210",
  businessPhoneVerifiedAt: new Date("2026-08-01T00:00:00Z"),
  ...over,
});

const listing = (over: Partial<ListingSnapshot> = {}): ListingSnapshot => ({
  id: "listing_1",
  lifecycle: "ACTIVE",
  brokerOrgId: "org_seller",
  cityId: "city_ahmedabad",
  localityId: "loc_thaltej",
  propertyType: "APARTMENT",
  priceInr: 11_000_000,
  bhk: 3,
  areaSqft: 1540,
  mediaCount: 6,
  verification: "RERA_VERIFIED",
  ...over,
});

const failures = (result: ReturnType<typeof checkSupplyPublish>) => (result.ok ? [] : result.failures);

describe("who may trade on the channel", () => {
  it("admits verified partners and RERA-verified agencies", () => {
    expect(isTradeableOrganization(org({ verificationStatus: "RERA_VERIFIED" }))).toBe(true);
    expect(isTradeableOrganization(org({ verificationStatus: "VERIFIED_PARTNER" }))).toBe(true);
  });

  it("excludes unvetted agencies", () => {
    // An unvetted agency should not be able to pull a competitor's inventory.
    for (const status of ["DEMO", "SOURCE_REVIEWED", "DISPUTED", "STALE"]) {
      expect(isTradeableOrganization(org({ verificationStatus: status }))).toBe(false);
    }
  });
});

describe("publishing SUPPLY requires a real listing", () => {
  it("accepts an active, owned, photographed listing", () => {
    expect(checkSupplyPublish({ organization: org(), listing: listing() })).toEqual({ ok: true });
  });

  it("refuses a listing belonging to another brokerage", () => {
    // Otherwise an agency could trade on inventory it does not represent.
    expect(failures(checkSupplyPublish({ organization: org(), listing: listing({ brokerOrgId: "org_other" }) })))
      .toContain("LISTING_NOT_OWNED_BY_ORG");
  });

  it("refuses anything that is not live on the public site", () => {
    /* This is the rule that makes the channel grow the catalogue: to trade, the
       broker must first publish real inventory publicly. */
    for (const lifecycle of ["DRAFT", "IN_REVIEW", "SOLD", "EXPIRED", "ARCHIVED"]) {
      expect(failures(checkSupplyPublish({ organization: org(), listing: listing({ lifecycle }) })))
        .toContain("LISTING_NOT_ACTIVE");
    }
  });

  it("refuses a listing with no photos", () => {
    // Without photos the anchor gains the counterparty nothing over plain text.
    expect(failures(checkSupplyPublish({ organization: org(), listing: listing({ mediaCount: 0 }) })))
      .toContain("LISTING_HAS_NO_PHOTOS");
  });

  it("refuses an agency with no verified business number", () => {
    /* An accepted match would otherwise strand the counterparty with nobody to
       call, discovered only after both sides accepted. */
    expect(failures(checkSupplyPublish({ organization: org({ businessPhoneE164: null }), listing: listing() })))
      .toContain("ORG_HAS_NO_VERIFIED_PHONE");
    expect(failures(checkSupplyPublish({ organization: org({ businessPhoneVerifiedAt: null }), listing: listing() })))
      .toContain("ORG_HAS_NO_VERIFIED_PHONE");
  });

  it("reports every problem at once rather than one per attempt", () => {
    const result = checkSupplyPublish({
      organization: org({ verificationStatus: "DEMO", businessPhoneE164: null }),
      listing: listing({ lifecycle: "DRAFT", mediaCount: 0 }),
    });
    expect(failures(result)).toEqual(
      expect.arrayContaining([
        "ORG_NOT_VERIFIED", "ORG_HAS_NO_VERIFIED_PHONE", "LISTING_NOT_ACTIVE", "LISTING_HAS_NO_PHOTOS",
      ]),
    );
  });
});

describe("publishing DEMAND", () => {
  it("accepts structured criteria with a budget", () => {
    expect(checkDemandPublish({ organization: org(), budgetMaxInr: 12_000_000 })).toEqual({ ok: true });
  });

  it("refuses a listing reference, because demand has no listing yet", () => {
    expect(failures(checkDemandPublish({ organization: org(), listingId: "listing_1", budgetMaxInr: 1 })))
      .toContain("DEMAND_MUST_NOT_HAVE_LISTING");
  });

  it("requires a budget ceiling so the request is not noise for everyone", () => {
    expect(failures(checkDemandPublish({ organization: org(), budgetMaxInr: null })))
      .toContain("DEMAND_REQUIRES_BUDGET");
    expect(failures(checkDemandPublish({ organization: org(), budgetMaxInr: 0 })))
      .toContain("DEMAND_REQUIRES_BUDGET");
  });
});

describe("the broker note must not carry customer contact details", () => {
  it("catches phone numbers in the shapes brokers actually type", () => {
    for (const note of [
      "Buyer 9876543210 wants 3BHK",
      "call +91 98765 43210",
      "reach on 98765-43210",
      "client no 98765 43210",
    ]) {
      expect(findContactDetails(note)).toContain("phone number");
    }
  });

  it("catches email addresses", () => {
    expect(findContactDetails("mail asha.patel@example.com")).toContain("email address");
  });

  it("catches attempts to route around the platform", () => {
    expect(findContactDetails("whatsapp me for details")).toContain("contact instruction");
    expect(findContactDetails("Call me to discuss")).toContain("contact instruction");
  });

  it("allows a legitimate structured note", () => {
    expect(findContactDetails("Buyer needs 3BHK in Thaltej, ready to move, loan pre-approved")).toEqual([]);
  });

  it("does not mistake a price or area for a phone number", () => {
    // 7-digit prices and 4-digit areas must not trip the detector.
    expect(findContactDetails("Budget 1.2 Cr, area 1540 sq ft, 3 BHK")).toEqual([]);
  });

  it("blocks publishing on either request type", () => {
    expect(failures(checkSupplyPublish({ organization: org(), listing: listing(), brokerNote: "call 9876543210" })))
      .toContain("NOTE_CONTAINS_CONTACT_DETAILS");
    expect(failures(checkDemandPublish({ organization: org(), budgetMaxInr: 1, brokerNote: "a@b.com" })))
      .toContain("NOTE_CONTAINS_CONTACT_DETAILS");
  });
});

describe("denormalised search fields", () => {
  it("copies scope from the listing so the matcher needs no join", () => {
    expect(supplySearchFieldsFromListing(listing())).toEqual({
      cityId: "city_ahmedabad",
      localityId: "loc_thaltej",
      propertyType: "APARTMENT",
    });
  });
});

describe("contact reveal is mutual", () => {
  const pending = { demandAcceptedAt: null, supplyAcceptedAt: null, rejectedAt: null };
  const oneSided = { demandAcceptedAt: new Date(), supplyAcceptedAt: null, rejectedAt: null };
  const both = { demandAcceptedAt: new Date(), supplyAcceptedAt: new Date(), rejectedAt: null };

  it("connects only when both sides accept", () => {
    expect(isConnected(pending)).toBe(false);
    expect(isConnected(oneSided)).toBe(false);
    expect(isConnected(both)).toBe(true);
  });

  it("stays disconnected if either side rejected", () => {
    expect(isConnected({ ...both, rejectedAt: new Date() })).toBe(false);
  });

  it("withholds the number until connected", () => {
    /* A one-sided accept revealing the number would let anyone scrape agency
       phone numbers by accepting everything. */
    const contact = counterpartyContact(org(), oneSided);
    expect(contact.connected).toBe(false);
    expect(contact.businessPhoneE164).toBeUndefined();
    expect(contact.telLink).toBeUndefined();
    expect(contact.waMeLink).toBeUndefined();
  });

  it("shows a masked number before connection so the UI has something to render", () => {
    expect(counterpartyContact(org(), pending).businessPhoneMasked).toBe("+91 ••••• 3210");
  });

  it("reveals number and tap-to-call links once connected", () => {
    const contact = counterpartyContact(org(), both);
    expect(contact.businessPhoneE164).toBe("+919876543210");
    expect(contact.telLink).toBe("tel:+919876543210");
    expect(contact.waMeLink).toBe("https://wa.me/919876543210");
  });

  it("never leaks a number that was never verified", () => {
    const contact = counterpartyContact(org({ businessPhoneVerifiedAt: null }), both);
    expect(contact.businessPhoneE164).toBeUndefined();
  });

  it("handles a missing number without crashing", () => {
    const contact = counterpartyContact(org({ businessPhoneE164: null }), both);
    expect(contact.businessPhoneMasked).toBe("Not provided");
    expect(contact.businessPhoneE164).toBeUndefined();
  });

  it("exposes the brokerage name and verification at every stage", () => {
    // Enough to judge the counterparty before deciding to accept.
    const contact = counterpartyContact(org(), pending);
    expect(contact.organizationName).toBe("Skyline Realty");
    expect(contact.verificationStatus).toBe("RERA_VERIFIED");
  });
});
