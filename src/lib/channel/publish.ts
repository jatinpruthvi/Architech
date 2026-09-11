/* Rules for publishing a channel request, and for revealing contact details.

   THE LISTING-FIRST WORKFLOW

   A SUPPLY request cannot be invented. The broker must first create a Listing
   and get it to ACTIVE, then publish that listing to the channel. Everything
   good about the channel follows from that ordering:

     - the counterparty sees real photos, RERA status and locality, not a
       retyped summary that can drift from the truth;
     - the score means something, because it is computed over verified data;
     - the public catalogue grows as a by-product of brokers trading.

   DEMAND has no listing, so it carries structured criteria instead. It also
   carries no customer identity -- a demand request says what a buyer wants,
   never who they are.

   CONTACT REVEAL

   The counterparty's business number appears only when BOTH sides accept. A
   one-sided accept reveals nothing, which stops the channel being scraped for
   agency phone numbers by anyone willing to click accept on everything. */

import { normalizeIndianPhone, telLink, waMeLink } from "@/lib/interop/phone";

export type ListingSnapshot = {
  id: string;
  lifecycle: string;
  brokerOrgId: string | null;
  cityId: string;
  localityId: string | null;
  propertyType: string;
  priceInr: number;
  bhk: number | null;
  areaSqft: number | null;
  mediaCount: number;
  verification: string | null;
};

export type OrganizationSnapshot = {
  id: string;
  name: string;
  verificationStatus: string;
  businessPhoneE164: string | null;
  businessPhoneVerifiedAt: Date | null;
};

export type PublishFailure =
  | "ORG_NOT_VERIFIED"
  | "ORG_HAS_NO_VERIFIED_PHONE"
  | "LISTING_REQUIRED_FOR_SUPPLY"
  | "LISTING_NOT_OWNED_BY_ORG"
  | "LISTING_NOT_ACTIVE"
  | "LISTING_HAS_NO_PHOTOS"
  | "DEMAND_MUST_NOT_HAVE_LISTING"
  | "DEMAND_REQUIRES_BUDGET"
  | "NOTE_CONTAINS_CONTACT_DETAILS";

export type PublishCheck = { ok: true } | { ok: false; failures: PublishFailure[] };

/* Verification tiers allowed to trade on the channel. DEMO and SOURCE_REVIEWED
   are not: an unvetted agency should not be able to pull a competitor's
   inventory or receive their callback. */
const TRADEABLE_VERIFICATION = new Set(["VERIFIED_PARTNER", "RERA_VERIFIED"]);

export function isTradeableOrganization(org: OrganizationSnapshot): boolean {
  return TRADEABLE_VERIFICATION.has(org.verificationStatus);
}

/* Contact-shaped content in a free-text field is the most likely way customer
   PII reaches the channel, so the note is screened rather than trusted.

   Detects Indian mobile numbers with or without separators, e-mail addresses,
   and the "call me on" phrasing brokers use when they try to route around the
   platform. Deliberately strict: a false positive costs one edit, a false
   negative puts a customer's number in front of another agency. */
const CONTACT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/, label: "phone number" },
  { pattern: /[\w.+-]+@[\w-]+\.[\w.]+/, label: "email address" },
  { pattern: /\b(?:whatsapp|wa\.me|call me|phone me|ring me)\b/i, label: "contact instruction" },
  { pattern: /\b\d{5}[\s-]?\d{5}\b/, label: "phone number" },
];

export function findContactDetails(note: string): string[] {
  const found = new Set<string>();
  for (const { pattern, label } of CONTACT_PATTERNS) if (pattern.test(note)) found.add(label);
  return [...found];
}

export type SupplyPublishInput = {
  organization: OrganizationSnapshot;
  listing: ListingSnapshot;
  brokerNote?: string | null;
};

/* Can this brokerage publish this listing as SUPPLY?

   Returns every failure rather than the first, so a broker fixes one form
   instead of discovering problems one at a time. */
export function checkSupplyPublish({ organization, listing, brokerNote }: SupplyPublishInput): PublishCheck {
  const failures: PublishFailure[] = [];

  if (!isTradeableOrganization(organization)) failures.push("ORG_NOT_VERIFIED");

  /* No verified number means an accepted match would strand the counterparty
     with nobody to call, so this is blocked at publish rather than discovered
     after both sides have accepted. */
  if (!organization.businessPhoneE164 || !organization.businessPhoneVerifiedAt) {
    failures.push("ORG_HAS_NO_VERIFIED_PHONE");
  }

  if (listing.brokerOrgId !== organization.id) failures.push("LISTING_NOT_OWNED_BY_ORG");
  if (listing.lifecycle !== "ACTIVE") failures.push("LISTING_NOT_ACTIVE");

  /* Photos are the point of anchoring on a listing: without them the
     counterparty gains nothing over a plain text offer. */
  if (listing.mediaCount < 1) failures.push("LISTING_HAS_NO_PHOTOS");

  if (brokerNote && findContactDetails(brokerNote).length > 0) {
    failures.push("NOTE_CONTAINS_CONTACT_DETAILS");
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

export type DemandPublishInput = {
  organization: OrganizationSnapshot;
  listingId?: string | null;
  budgetMaxInr?: number | null;
  brokerNote?: string | null;
};

export function checkDemandPublish({
  organization,
  listingId,
  budgetMaxInr,
  brokerNote,
}: DemandPublishInput): PublishCheck {
  const failures: PublishFailure[] = [];

  if (!isTradeableOrganization(organization)) failures.push("ORG_NOT_VERIFIED");
  if (!organization.businessPhoneE164 || !organization.businessPhoneVerifiedAt) {
    failures.push("ORG_HAS_NO_VERIFIED_PHONE");
  }
  if (listingId) failures.push("DEMAND_MUST_NOT_HAVE_LISTING");

  /* Without a ceiling the matcher cannot score budget fit, and the request
     matches almost everything -- which is noise for every other agency. */
  if (budgetMaxInr == null || budgetMaxInr <= 0) failures.push("DEMAND_REQUIRES_BUDGET");

  if (brokerNote && findContactDetails(brokerNote).length > 0) {
    failures.push("NOTE_CONTAINS_CONTACT_DETAILS");
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

/* Denormalise a listing into the request's search columns.

   Copied at publish time so the matcher filters without a join, and refreshed
   on re-publish. The listing stays authoritative; these are a search index. */
export function supplySearchFieldsFromListing(listing: ListingSnapshot) {
  return {
    cityId: listing.cityId,
    localityId: listing.localityId,
    propertyType: listing.propertyType,
  };
}

// ---------------------------------------------------------------------------
// Contact reveal
// ---------------------------------------------------------------------------

export type MatchAcceptanceState = {
  demandAcceptedAt: Date | null;
  supplyAcceptedAt: Date | null;
  rejectedAt: Date | null;
};

/** Contact is mutual: both sides must have accepted, and neither rejected. */
export function isConnected(match: MatchAcceptanceState): boolean {
  return match.rejectedAt === null && match.demandAcceptedAt !== null && match.supplyAcceptedAt !== null;
}

export type CounterpartyContact = {
  organizationName: string;
  verificationStatus: string;
  /** Present only once connected. */
  businessPhoneE164?: string;
  telLink?: string;
  waMeLink?: string;
  /** Always present, so the UI can show something before connection. */
  businessPhoneMasked: string;
  connected: boolean;
};

/* Build the counterparty contact block for a match.

   Before both accepts this returns a masked number and no links. It is not the
   UI's job to remember to hide the number -- the value is simply absent from
   the payload, so a template that renders it prints nothing. */
export function counterpartyContact(
  org: OrganizationSnapshot,
  match: MatchAcceptanceState,
): CounterpartyContact {
  const connected = isConnected(match);
  const parsed = org.businessPhoneE164 ? normalizeIndianPhone(org.businessPhoneE164) : null;
  const masked = parsed?.ok ? `+91 ••••• ${parsed.last4}` : "Not provided";

  if (!connected || !parsed?.ok || !org.businessPhoneVerifiedAt) {
    return {
      organizationName: org.name,
      verificationStatus: org.verificationStatus,
      businessPhoneMasked: masked,
      connected,
    };
  }

  return {
    organizationName: org.name,
    verificationStatus: org.verificationStatus,
    businessPhoneE164: parsed.e164,
    telLink: telLink(parsed.e164),
    waMeLink: waMeLink(parsed.e164),
    businessPhoneMasked: masked,
    connected: true,
  };
}
