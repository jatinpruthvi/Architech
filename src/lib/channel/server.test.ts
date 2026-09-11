import { beforeEach, describe, expect, it } from "vitest";
import {
  closeRequestForServer,
  getMatchForServer,
  listMyMatchesForServer,
  listMyRequestsForServer,
  listNotificationsForServer,
  listOfferableListings,
  markNotificationsReadForServer,
  propertyToListingSnapshot,
  publishDemandForServer,
  publishSupplyForServer,
  resetChannelStateForTests,
  respondToMatchForServer,
  runMatcherForServer,
} from "./server";
import { demoBrokerSession } from "@/lib/auth/roles";
import type { AuthSession } from "@/lib/auth/roles";
import { getListings } from "@/lib/repositories";

/* Two agencies on the same demo catalogue. The seller is the demo session
   (Nivasa Partners); the buyer is a second verified agency that owns nothing,
   which is exactly the shape of a real demand-side broker. */
const SELLER: AuthSession = demoBrokerSession;

const BUYER: AuthSession = {
  ...demoBrokerSession,
  user: { ...demoBrokerSession.user, id: "user_buyer" },
  organization: {
    id: "demo-org-buyer-realty",
    slug: "buyer-realty",
    name: "Buyer Realty",
    verificationStatus: "VERIFIED_PARTNER",
  },
};

/* A listing represented by Nivasa Partners in the demo catalogue. Resolved
   rather than hardcoded so a fixture edit fails loudly here. */
const SELLER_LISTING = getListings().find((p) => p.developer === "Nivasa Partners" && p.transaction === "buy")!;

const demandBody = {
  intent: "BUY" as const,
  cityId: SELLER_LISTING.citySlug,
  localityId: SELLER_LISTING.localitySlug,
  propertyType: SELLER_LISTING.propertyType,
  budgetMaxInr: Math.round(SELLER_LISTING.priceNum * 1.05),
  bhkMin: SELLER_LISTING.bhk,
  bhkMax: SELLER_LISTING.bhk,
};

beforeEach(() => {
  resetChannelStateForTests();
});

async function seedMatch() {
  const supply = await publishSupplyForServer({ intent: "BUY", listingId: SELLER_LISTING.id }, SELLER);
  expect(supply.ok).toBe(true);
  const demand = publishDemandForServer(demandBody, BUYER);
  expect(demand.ok).toBe(true);
  await runMatcherForServer(SELLER);
}

describe("resolving listings from the catalogue", () => {
  it("only offers an agency its own inventory", async () => {
    const listings = await listOfferableListings(SELLER);
    expect(listings.length).toBeGreaterThan(0);
    expect(listings.some((l) => l.id === SELLER_LISTING.id)).toBe(true);
  });

  it("offers a listing-less agency nothing", async () => {
    expect(await listOfferableListings(BUYER)).toEqual([]);
  });

  it("reads verification and photo count from the listing itself", () => {
    // These feed the listingQuality weight, so a bad mapping silently shifts scores.
    const snapshot = propertyToListingSnapshot(SELLER_LISTING, SELLER);
    expect(snapshot.mediaCount).toBeGreaterThan(0);
    expect(snapshot.priceInr).toBe(SELLER_LISTING.priceNum);
  });
});

describe("publishing through the server adapter", () => {
  it("copies search scope from the listing rather than trusting the client", async () => {
    /* A client-supplied city would let an offer advertise itself into a market
       its listing is not in. */
    const result = await publishSupplyForServer({ intent: "BUY", listingId: SELLER_LISTING.id }, SELLER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.cityId).toBe(SELLER_LISTING.citySlug);
      expect(result.data.localityId).toBe(SELLER_LISTING.localitySlug);
      expect(result.data.listingId).toBe(SELLER_LISTING.id);
    }
  });

  it("refuses to offer a listing the agency does not represent", async () => {
    const result = await publishSupplyForServer({ intent: "BUY", listingId: SELLER_LISTING.id }, BUYER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect([403, 404]).toContain(result.status);
  });

  it("reports an unknown listing as not found", async () => {
    const result = await publishSupplyForServer({ intent: "BUY", listingId: "no-such-listing" }, SELLER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("counts matches against each of the agency's own requests", async () => {
    await seedMatch();
    const [request] = listMyRequestsForServer(BUYER);
    expect(request.matchCount).toBe(1);
  });

  it("withdraws a request", async () => {
    const created = publishDemandForServer(demandBody, BUYER);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const closed = closeRequestForServer(created.data.id, BUYER);
    expect(closed.ok && closed.data.status).toBe("CLOSED");
  });

  it("will not let one agency withdraw another's request", async () => {
    const created = publishDemandForServer(demandBody, BUYER);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const result = closeRequestForServer(created.data.id, SELLER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});

describe("what each side of a match is shown", () => {
  it("matches two different agencies on real inventory", async () => {
    await seedMatch();
    expect(await listMyMatchesForServer(BUYER)).toHaveLength(1);
    expect(await listMyMatchesForServer(SELLER)).toHaveLength(1);
  });

  it("gives the demand side the listing, with a link to its public page", async () => {
    // The anchor: the counterparty judges photos and RERA, not a retyped summary.
    const [match] = await listMyMatchesForServer(BUYER);
    expect(match).toBeUndefined();
    await seedMatch();
    const [buyerMatch] = await listMyMatchesForServer(BUYER);
    expect(buyerMatch.side).toBe("DEMAND");
    expect(buyerMatch.listing?.id).toBe(SELLER_LISTING.id);
    expect(buyerMatch.listing?.href).toContain(SELLER_LISTING.id);
    expect(buyerMatch.listing?.mediaCount).toBeGreaterThan(0);
  });

  it("gives the supply side the requirement, never a listing", async () => {
    await seedMatch();
    const [sellerMatch] = await listMyMatchesForServer(SELLER);
    expect(sellerMatch.side).toBe("SUPPLY");
    expect(sellerMatch.requirement?.budgetMaxInr).toBe(demandBody.budgetMaxInr);
    expect(sellerMatch.listing).toBeNull();
  });

  it("explains the score", async () => {
    await seedMatch();
    const [match] = await listMyMatchesForServer(BUYER);
    expect(match.reasons.length).toBeGreaterThan(0);
    expect(match.score).toBeGreaterThanOrEqual(40);
  });

  it("shows nothing to an agency that is not a participant", async () => {
    await seedMatch();
    const outsider: AuthSession = {
      ...BUYER,
      organization: { ...BUYER.organization!, id: "demo-org-nosy", name: "Nosy Estates" },
    };
    expect(await listMyMatchesForServer(outsider)).toEqual([]);
    const [match] = await listMyMatchesForServer(BUYER);
    expect(await getMatchForServer(match.id, outsider)).toBeNull();
  });
});

describe("contact is revealed only when both sides accept", () => {
  it("withholds the number before anyone accepts", async () => {
    await seedMatch();
    const [match] = await listMyMatchesForServer(BUYER);
    expect(match.contact.connected).toBe(false);
    expect(match.contact.businessPhoneE164).toBeUndefined();
    expect(match.contact.telLink).toBeUndefined();
  });

  it("still withholds it after only one side accepts", async () => {
    /* The property that stops the channel being scraped by an agency that
       accepts everything. */
    await seedMatch();
    const [match] = await listMyMatchesForServer(BUYER);
    const accepted = await respondToMatchForServer(match.id, "accept", BUYER);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.data.contact.connected).toBe(false);
      expect(accepted.data.contact.businessPhoneE164).toBeUndefined();
    }
    const [sellerView] = await listMyMatchesForServer(SELLER);
    expect(sellerView.contact.businessPhoneE164).toBeUndefined();
  });

  it("reveals the number to both sides on the second accept", async () => {
    await seedMatch();
    const [match] = await listMyMatchesForServer(BUYER);
    await respondToMatchForServer(match.id, "accept", BUYER);
    const connected = await respondToMatchForServer(match.id, "accept", SELLER);
    expect(connected.ok).toBe(true);
    if (connected.ok) {
      expect(connected.data.contact.connected).toBe(true);
      expect(connected.data.contact.businessPhoneE164).toMatch(/^\+91\d{10}$/);
      expect(connected.data.contact.telLink).toMatch(/^tel:/);
      expect(connected.data.contact.waMeLink).toMatch(/^https:\/\/wa\.me\//);
    }
    const [buyerView] = await listMyMatchesForServer(BUYER);
    expect(buyerView.contact.connected).toBe(true);
    expect(buyerView.contact.businessPhoneE164).toBeDefined();
  });

  it("keeps the number hidden when a side declines", async () => {
    await seedMatch();
    const [match] = await listMyMatchesForServer(BUYER);
    await respondToMatchForServer(match.id, "accept", BUYER);
    await respondToMatchForServer(match.id, "reject", SELLER);
    const [buyerView] = await listMyMatchesForServer(BUYER);
    expect(buyerView.viewState).toBe("REJECTED");
    expect(buyerView.contact.businessPhoneE164).toBeUndefined();
  });

  it("refuses a response from an agency outside the match", async () => {
    await seedMatch();
    const [match] = await listMyMatchesForServer(BUYER);
    const outsider: AuthSession = {
      ...BUYER,
      organization: { ...BUYER.organization!, id: "demo-org-nosy", name: "Nosy Estates" },
    };
    const result = await respondToMatchForServer(match.id, "accept", outsider);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("refuses a double accept", async () => {
    await seedMatch();
    const [match] = await listMyMatchesForServer(BUYER);
    await respondToMatchForServer(match.id, "accept", BUYER);
    const second = await respondToMatchForServer(match.id, "accept", BUYER);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe(409);
  });
});

describe("notifications", () => {
  it("tells both agencies about a new match", async () => {
    await seedMatch();
    expect(listNotificationsForServer(BUYER)).toHaveLength(1);
    expect(listNotificationsForServer(SELLER)).toHaveLength(1);
  });

  it("tells the counterparty when a side accepts", async () => {
    await seedMatch();
    const [match] = await listMyMatchesForServer(BUYER);
    await respondToMatchForServer(match.id, "accept", BUYER);
    expect(listNotificationsForServer(SELLER)[0].kind).toBe("MATCH_ACCEPTED");
  });

  it("marks an agency's own notifications read and leaves others alone", async () => {
    await seedMatch();
    const [own] = listNotificationsForServer(BUYER);
    expect(markNotificationsReadForServer(BUYER, [own.id])).toBe(1);
    expect(listNotificationsForServer(BUYER, true)).toHaveLength(0);
    expect(listNotificationsForServer(SELLER, true)).toHaveLength(1);
  });

  it("ignores another agency's notification ids", async () => {
    await seedMatch();
    const [sellersOwn] = listNotificationsForServer(SELLER);
    expect(markNotificationsReadForServer(BUYER, [sellersOwn.id])).toBe(0);
  });
});

describe("re-running the matcher", () => {
  it("does not duplicate an existing pairing", async () => {
    await seedMatch();
    await runMatcherForServer(SELLER);
    expect(await listMyMatchesForServer(BUYER)).toHaveLength(1);
  });

  it("leaves an answered match untouched", async () => {
    await seedMatch();
    const [match] = await listMyMatchesForServer(BUYER);
    await respondToMatchForServer(match.id, "accept", BUYER);
    await runMatcherForServer(SELLER);
    const [after] = await listMyMatchesForServer(BUYER);
    expect(after.viewState).toBe("AWAITING_THEM");
  });
});
