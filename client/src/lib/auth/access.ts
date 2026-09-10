export const LISTING_VISIBILITIES = ["PUBLIC", "OWNER_DIRECT", "BROKER_SHAREABLE", "PRIVATE"] as const;
export type ListingVisibility = (typeof LISTING_VISIBILITIES)[number];

export const ADDRESS_VISIBILITIES = ["LOCALITY_ONLY", "REQUEST_AFTER_LEAD", "APPOINTMENT_ONLY", "PUBLIC_EXACT"] as const;
export type AddressVisibility = (typeof ADDRESS_VISIBILITIES)[number];

export const CONTACT_VISIBILITIES = ["RELAY_ONLY", "REQUEST_APPROVAL", "PUBLIC_BUSINESS"] as const;
export type ContactVisibility = (typeof CONTACT_VISIBILITIES)[number];

export const MARKETPLACE_ENTITLEMENTS = {
  listingView: "listing.view",
  ownerDirectFilter: "listing.owner_direct_filter",
  leadCreate: "contact.lead.create",
  relayCall: "contact.relay.call",
  relayWhatsapp: "contact.relay.whatsapp",
  exactAddressRequest: "location.exact_request",
  exactAddressView: "location.exact_view",
  brokerShare: "inventory.broker_share",
  export: "inventory.export",
} as const;

export type MarketplaceEntitlement = (typeof MARKETPLACE_ENTITLEMENTS)[keyof typeof MARKETPLACE_ENTITLEMENTS];

export type PublicListingAccess = {
  visibility: ListingVisibility;
  addressVisibility: AddressVisibility;
  contactVisibility: ContactVisibility;
  phoneMasked?: string | null;
  locality?: string | null;
  publicLatitude?: number | null;
  publicLongitude?: number | null;
  exactAddress?: string | null;
};

export type MarketplaceCapabilities = {
  canView: boolean;
  canFilterOwnerDirect: boolean;
  canCreateLead: boolean;
  canRelayCall: boolean;
  canRelayWhatsapp: boolean;
  canRequestExactAddress: boolean;
  canViewExactAddress: boolean;
  canViewBrokerInventory: boolean;
  denial?: "ROLE_REQUIRED" | "PLAN_REQUIRED" | "OWNER_APPROVAL_REQUIRED" | "NOT_SHAREABLE" | "RATE_LIMITED";
};

export function safePublicLocation(input: Pick<PublicListingAccess, "locality" | "publicLatitude" | "publicLongitude">) {
  return {
    locality: input.locality ?? null,
    latitude: input.publicLatitude ?? null,
    longitude: input.publicLongitude ?? null,
  };
}

export function capabilitiesFor(input: {
  visibility: ListingVisibility;
  addressVisibility: AddressVisibility;
  contactVisibility: ContactVisibility;
  signedIn: boolean;
  paidBroker: boolean;
  verifiedAdvertiser: boolean;
}): MarketplaceCapabilities {
  const brokerInventory = input.paidBroker && input.visibility === "BROKER_SHAREABLE";
  const ownerDirect = input.paidBroker && input.visibility === "OWNER_DIRECT";
  const canRequestAddress = input.signedIn && (input.paidBroker || input.verifiedAdvertiser) && input.addressVisibility !== "LOCALITY_ONLY";
  return {
    canView: input.visibility !== "PRIVATE" || input.verifiedAdvertiser,
    canFilterOwnerDirect: input.paidBroker,
    canCreateLead: input.signedIn,
    canRelayCall: input.signedIn && (input.paidBroker || input.verifiedAdvertiser) && input.contactVisibility !== "PUBLIC_BUSINESS",
    canRelayWhatsapp: input.signedIn && (input.paidBroker || input.verifiedAdvertiser),
    canRequestExactAddress: canRequestAddress,
    canViewExactAddress: input.verifiedAdvertiser && input.addressVisibility === "PUBLIC_EXACT",
    canViewBrokerInventory: brokerInventory || ownerDirect,
    denial: input.visibility === "PRIVATE" && !input.verifiedAdvertiser ? "ROLE_REQUIRED" : undefined,
  };
}

export const MARKETPLACE_PLAN_SEEDS = [
  { code: "FREE", name: "Free", monthlyCredits: 0, teamSeats: 1, entitlements: ["listing.view", "contact.lead.create"] },
  { code: "BROKER_STARTER", name: "Verified Broker Starter", monthlyCredits: 10, teamSeats: 1, entitlements: ["listing.view", "listing.owner_direct_filter", "contact.lead.create", "contact.relay.call", "contact.relay.whatsapp", "location.exact_request", "inventory.broker_share"] },
  { code: "BROKER_PRO", name: "Broker Pro", monthlyCredits: 40, teamSeats: 3, entitlements: ["listing.view", "listing.owner_direct_filter", "contact.lead.create", "contact.relay.call", "contact.relay.whatsapp", "location.exact_request", "inventory.broker_share"] },
  { code: "BROKERAGE_TEAM", name: "Brokerage Team", monthlyCredits: 120, teamSeats: 10, entitlements: ["listing.view", "listing.owner_direct_filter", "contact.lead.create", "contact.relay.call", "contact.relay.whatsapp", "location.exact_request", "inventory.broker_share"] },
] as const;
