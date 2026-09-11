import { beforeEach, describe, expect, it } from "vitest";
import {
  ChannelStoreError,
  closeRequest,
  createChannelState,
  createRequest,
  expireStaleRequests,
  getMatchForOrg,
  listMatchesForOrg,
  listNotifications,
  listRequestsForOrg,
  markNotificationsRead,
  respondToMatch,
  runMatcher,
  type ChannelState,
  type CreateRequestInput,
  type ListingFacts,
} from "./store";

const SELLER = "org_seller";
const BUYER = "org_buyer";
const T0 = new Date("2026-09-04T10:00:00Z");
const later = (mins: number) => new Date(T0.getTime() + mins * 60_000);

let state: ChannelState;
let listings: Map<string, ListingFacts>;

const LISTING: ListingFacts = {
  id: "listing_1",
  priceInr: 11_000_000,
  bhk: 3,
  areaSqft: 1540,
  verification: "RERA_VERIFIED",
  mediaCount: 6,
};

beforeEach(() => {
  state = createChannelState();
  listings = new Map([[LISTING.id, LISTING]]);
});

const supplyInput = (over: Partial<CreateRequestInput> = {}): CreateRequestInput => ({
  organizationId: SELLER,
  type: "SUPPLY",
  intent: "BUY",
  cityId: "city_1",
  localityId: "loc_1",
  propertyType: "APARTMENT",
  listingId: LISTING.id,
  ...over,
});

const demandInput = (over: Partial<CreateRequestInput> = {}): CreateRequestInput => ({
  organizationId: BUYER,
  type: "DEMAND",
  intent: "BUY",
  cityId: "city_1",
  localityId: "loc_1",
  propertyType: "APARTMENT",
  budgetMaxInr: 12_000_000,
  bhkMin: 3,
  bhkMax: 3,
  ...over,
});

/** The whole workflow: offer a listing, post a requirement, match them. */
function seedMatchedPair() {
  createRequest(state, supplyInput(), T0);
  createRequest(state, demandInput(), T0);
  return runMatcher(state, listings, later(1));
}

describe("creating requests", () => {
  it("publishes an offer against a listing", () => {
    const request = createRequest(state, supplyInput(), T0);
    expect(request.status).toBe("OPEN");
    expect(request.listingId).toBe(LISTING.id);
    expect(request.publishedAt).toEqual(T0);
  });

  it("can hold a request as a draft the broker finishes later", () => {
    const request = createRequest(state, supplyInput({ publish: false }), T0);
    expect(request.status).toBe("DRAFT");
    expect(request.publishedAt).toBeNull();
  });

  it("defaults the expiry 30 days out", () => {
    expect(createRequest(state, demandInput(), T0).expiresAt.toISOString()).toBe("2026-10-04T10:00:00.000Z");
  });

  it("refuses an offer with no listing behind it", () => {
    // Mirrors the supply_requires_listing CHECK constraint.
    expect(() => createRequest(state, supplyInput({ listingId: null }), T0)).toThrow(ChannelStoreError);
  });

  it("refuses a requirement that references a listing", () => {
    expect(() => createRequest(state, demandInput({ listingId: LISTING.id }), T0)).toThrow(
      /must not reference a listing/,
    );
  });

  it("refuses a budget on an offer, where the listing owns the price", () => {
    expect(() => createRequest(state, supplyInput({ budgetMaxInr: 1 }), T0)).toThrow(/Budget belongs to demand/);
  });

  it("refuses to offer the same listing twice while one is live", () => {
    /* Otherwise one agency could flood every inbox by republishing the same
       flat. Mirrors the partial unique index. */
    createRequest(state, supplyInput(), T0);
    expect(() => createRequest(state, supplyInput(), later(5))).toThrow(/already offered/);
  });

  it("allows re-offering once the previous offer is closed", () => {
    const first = createRequest(state, supplyInput(), T0);
    closeRequest(state, first.id, SELLER, later(5));
    expect(createRequest(state, supplyInput(), later(6)).status).toBe("OPEN");
  });

  it("does not let a draft block a real offer", () => {
    createRequest(state, supplyInput({ publish: false }), T0);
    expect(() => createRequest(state, supplyInput(), later(1))).not.toThrow();
  });
});

describe("closing requests", () => {
  it("closes a published request", () => {
    const request = createRequest(state, demandInput(), T0);
    expect(closeRequest(state, request.id, BUYER, later(5)).status).toBe("CLOSED");
  });

  it("cancels an unpublished draft, which was never live", () => {
    const request = createRequest(state, demandInput({ publish: false }), T0);
    expect(closeRequest(state, request.id, BUYER, later(5)).status).toBe("CANCELLED");
  });

  it("refuses to close another agency's request", () => {
    const request = createRequest(state, demandInput(), T0);
    expect(() => closeRequest(state, request.id, SELLER, later(5))).toThrow(/No such request/);
  });

  it("is idempotent, so a double click is harmless", () => {
    const request = createRequest(state, demandInput(), T0);
    closeRequest(state, request.id, BUYER, later(5));
    expect(closeRequest(state, request.id, BUYER, later(9)).closedAt).toEqual(later(5));
  });
});

describe("expiry", () => {
  it("ages out requests past their date", () => {
    createRequest(state, demandInput({ expiryDays: 1 }), T0);
    expect(expireStaleRequests(state, new Date("2026-09-06T10:00:00Z"))).toBe(1);
    expect(listRequestsForOrg(state, BUYER)[0].status).toBe("EXPIRED");
  });

  it("leaves live requests alone", () => {
    createRequest(state, demandInput(), T0);
    expect(expireStaleRequests(state, later(60))).toBe(0);
  });
});

describe("the matcher", () => {
  it("pairs a requirement with a matching offer and notifies both agencies", () => {
    const result = seedMatchedPair();
    expect(result.created).toBe(1);
    // Both sides are told, because either may act first.
    expect(result.notified).toBe(2);
    expect(listNotifications(state, BUYER)).toHaveLength(1);
    expect(listNotifications(state, SELLER)).toHaveLength(1);
  });

  it("scores against the listing, not against self-reported numbers", () => {
    seedMatchedPair();
    const [match] = listMatchesForOrg(state, BUYER);
    expect(match.score).toBeGreaterThan(0);
    expect(match.reasons.length).toBeGreaterThan(0);
  });

  it("moves both requests to matched", () => {
    seedMatchedPair();
    expect(listRequestsForOrg(state, BUYER)[0].status).toBe("MATCHED");
    expect(listRequestsForOrg(state, SELLER)[0].status).toBe("MATCHED");
  });

  it("never matches an agency with itself", () => {
    createRequest(state, supplyInput(), T0);
    createRequest(state, demandInput({ organizationId: SELLER }), T0);
    expect(runMatcher(state, listings, later(1)).created).toBe(0);
  });

  it("does not duplicate a pairing when re-run", () => {
    // Re-running is the only way to pick up a price change, so it must be safe.
    seedMatchedPair();
    const second = runMatcher(state, listings, later(10));
    expect(second.created).toBe(0);
    expect(listMatchesForOrg(state, BUYER)).toHaveLength(1);
  });

  it("rescores an untouched match when the listing price changes", () => {
    seedMatchedPair();
    const before = listMatchesForOrg(state, BUYER)[0].score;
    listings.set(LISTING.id, { ...LISTING, priceInr: 8_000_000 });
    runMatcher(state, listings, later(10));
    expect(listMatchesForOrg(state, BUYER)[0].score).not.toBe(before);
  });

  it("leaves an answered match alone when re-run", () => {
    /* Rescoring an accepted match, or resurrecting a rejected one, would undo a
       decision a human already made. */
    seedMatchedPair();
    const match = listMatchesForOrg(state, BUYER)[0];
    respondToMatch(state, match.id, BUYER, "reject", later(5));
    listings.set(LISTING.id, { ...LISTING, priceInr: 8_000_000 });
    runMatcher(state, listings, later(10));
    expect(getMatchForOrg(state, match.id, BUYER)?.status).toBe("REJECTED");
  });

  it("skips an offer whose listing has disappeared", () => {
    // Scoring it as zero would surface a broken card in the inbox.
    createRequest(state, supplyInput(), T0);
    createRequest(state, demandInput(), T0);
    expect(runMatcher(state, new Map(), later(1)).created).toBe(0);
  });

  it("does not match across cities", () => {
    createRequest(state, supplyInput(), T0);
    createRequest(state, demandInput({ cityId: "city_2" }), T0);
    expect(runMatcher(state, listings, later(1)).created).toBe(0);
  });

  it("does not match a rental requirement to a sale offer", () => {
    createRequest(state, supplyInput(), T0);
    createRequest(state, demandInput({ intent: "RENT" }), T0);
    expect(runMatcher(state, listings, later(1)).created).toBe(0);
  });

  it("does not surface an offer far over budget", () => {
    createRequest(state, supplyInput(), T0);
    createRequest(state, demandInput({ budgetMaxInr: 4_000_000 }), T0);
    expect(runMatcher(state, listings, later(1)).created).toBe(0);
  });

  it("expires stale requests as part of the run", () => {
    createRequest(state, demandInput({ expiryDays: 1 }), T0);
    expect(runMatcher(state, listings, new Date("2026-09-06T10:00:00Z")).expired).toBe(1);
  });
});

describe("responding to a match", () => {
  const setup = () => {
    seedMatchedPair();
    return listMatchesForOrg(state, BUYER)[0];
  };

  it("does not connect on one accept", () => {
    const match = setup();
    const result = respondToMatch(state, match.id, BUYER, "accept", later(5));
    expect(result.ok && result.connected).toBe(false);
    expect(getMatchForOrg(state, match.id, BUYER)?.status).toBe("ACCEPTED");
  });

  it("connects when both accept", () => {
    const match = setup();
    respondToMatch(state, match.id, BUYER, "accept", later(5));
    const second = respondToMatch(state, match.id, SELLER, "accept", later(9));
    expect(second.ok && second.connected).toBe(true);
    expect(getMatchForOrg(state, match.id, SELLER)?.connectedAt).toEqual(later(9));
  });

  it("tells the counterparty when one side accepts", () => {
    const match = setup();
    respondToMatch(state, match.id, BUYER, "accept", later(5));
    expect(listNotifications(state, SELLER)[0].kind).toBe("MATCH_ACCEPTED");
  });

  it("tells both sides when the connection is made", () => {
    // Including the side that just clicked: their screen may be stale.
    const match = setup();
    respondToMatch(state, match.id, BUYER, "accept", later(5));
    respondToMatch(state, match.id, SELLER, "accept", later(9));
    expect(listNotifications(state, BUYER)[0].kind).toBe("MATCH_CONNECTED");
    expect(listNotifications(state, SELLER)[0].kind).toBe("MATCH_CONNECTED");
  });

  it("records a decline and tells the other side", () => {
    const match = setup();
    expect(respondToMatch(state, match.id, SELLER, "reject", later(5)).ok).toBe(true);
    expect(listNotifications(state, BUYER)[0].kind).toBe("MATCH_REJECTED");
  });

  it("refuses a response from an agency that is not party to the match", () => {
    const match = setup();
    const result = respondToMatch(state, match.id, "org_nosy", "accept", later(5));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("No such match.");
  });

  it("refuses a double accept from the same side", () => {
    const match = setup();
    respondToMatch(state, match.id, BUYER, "accept", later(5));
    expect(respondToMatch(state, match.id, BUYER, "accept", later(6)).ok).toBe(false);
  });

  it("returns a plain not-found for an unknown match id", () => {
    expect(respondToMatch(state, "chmat_nope", BUYER, "accept", later(5)).ok).toBe(false);
  });
});

describe("reading matches", () => {
  it("shows a match to each participant", () => {
    seedMatchedPair();
    const [match] = listMatchesForOrg(state, BUYER);
    expect(getMatchForOrg(state, match.id, BUYER)).not.toBeNull();
    expect(getMatchForOrg(state, match.id, SELLER)).not.toBeNull();
  });

  it("hides it from everyone else", () => {
    /* Null rather than a thrown 403: a 403 would confirm the match exists,
       which is information about two other agencies. */
    seedMatchedPair();
    const [match] = listMatchesForOrg(state, BUYER);
    expect(getMatchForOrg(state, match.id, "org_nosy")).toBeNull();
    expect(listMatchesForOrg(state, "org_nosy")).toEqual([]);
  });
});

describe("notifications", () => {
  it("marks an agency's own notifications read", () => {
    seedMatchedPair();
    const [notification] = listNotifications(state, BUYER);
    expect(markNotificationsRead(state, BUYER, [notification.id], later(20))).toBe(1);
    expect(listNotifications(state, BUYER, { unreadOnly: true })).toHaveLength(0);
  });

  it("ignores another agency's ids instead of marking them", () => {
    seedMatchedPair();
    const [sellersOwn] = listNotifications(state, SELLER);
    expect(markNotificationsRead(state, BUYER, [sellersOwn.id], later(20))).toBe(0);
    expect(listNotifications(state, SELLER, { unreadOnly: true })).toHaveLength(1);
  });

  it("does not re-mark something already read", () => {
    seedMatchedPair();
    const [notification] = listNotifications(state, BUYER);
    markNotificationsRead(state, BUYER, [notification.id], later(20));
    expect(markNotificationsRead(state, BUYER, [notification.id], later(30))).toBe(0);
  });
});
