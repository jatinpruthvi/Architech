import "server-only";

/* Server adapter for the broker channel.

   Holds the process-wide channel state, resolves the listing and organization
   facts the gates need, and turns store results into the shapes the API routes
   return. The rules themselves live in the pure modules beside this file --
   this is wiring, so that the interesting logic stays testable without a
   server.

   Contact details are attached HERE and only here, by asking
   counterpartyContact, which omits the number entirely unless both sides have
   accepted. No route builds a contact block by hand. */

import { getListingByIdForServer, getListingsForServer } from "@/lib/repositories/server/prisma";
import { counterpartyContact, type CounterpartyContact, type ListingSnapshot, type OrganizationSnapshot } from "./publish";
import { decideDemandPublish, decideSupplyPublish, type DemandRequestInput, type SupplyRequestInput } from "./request";
import { describeViewState, sideFor, viewStateFor } from "./match-state";
import {
  ChannelStoreError,
  closeRequest,
  createChannelState,
  createRequest,
  getMatchForOrg,
  listMatchesForOrg,
  listNotifications,
  listRequestsForOrg,
  markNotificationsRead,
  respondToMatch,
  runMatcher,
  type ChannelState,
  type ListingFacts,
  type StoredMatch,
  type StoredRequest,
} from "./store";
import type { AuthSession } from "@/lib/auth/roles";
import type { Property } from "@/lib/properties";

declare global {
  var __architechChannel: ChannelState | undefined;
}

/* Survives hot reload in development, which otherwise wipes every request a
   broker just created and makes the feature look broken. */
function state(): ChannelState {
  if (!globalThis.__architechChannel) globalThis.__architechChannel = createChannelState();
  return globalThis.__architechChannel;
}

/** Test seam: drop all channel state. */
export function resetChannelStateForTests() {
  globalThis.__architechChannel = createChannelState();
}

// ---------------------------------------------------------------------------
// Resolving the facts the gates need
// ---------------------------------------------------------------------------

/* The demo catalogue has no per-listing organization column; `developer` is
   the agency that represents it. Mapping it here keeps the ownership check
   meaningful in memory mode instead of quietly passing everything. */
function organizationIdForProperty(property: Property, session: AuthSession): string | null {
  const orgName = session.organization?.name;
  if (orgName && property.developer === orgName) return session.organization?.id ?? null;
  return `demo-org-${property.developer.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function photoCountOf(property: Property): number {
  // `image` is the primary photo; `gallery` holds the rest.
  return (property.image ? 1 : 0) + (property.gallery?.length ?? 0);
}

/* A listing's verification tier, read from the badge the catalogue already
   shows. It feeds the listingQuality weight, so a bad mapping quietly changes
   scores rather than erroring -- hence the explicit table. */
function verificationOf(property: Property): string | null {
  const badge = property.badge?.toLowerCase() ?? "";
  if (badge.includes("rera")) return "RERA_VERIFIED";
  if (badge.includes("verified partner")) return "VERIFIED_PARTNER";
  if (badge.includes("source reviewed")) return "SOURCE_REVIEWED";
  return null;
}

export function propertyToListingSnapshot(property: Property, session: AuthSession): ListingSnapshot {
  return {
    id: property.id,
    lifecycle: property.lifecycle ?? "ACTIVE",
    brokerOrgId: organizationIdForProperty(property, session),
    cityId: property.citySlug,
    localityId: property.localitySlug,
    propertyType: property.propertyType,
    priceInr: property.priceNum,
    bhk: property.bhk,
    areaSqft: property.areaNum,
    mediaCount: photoCountOf(property),
    verification: verificationOf(property),
  };
}

function listingFactsOf(snapshot: ListingSnapshot): ListingFacts {
  return {
    id: snapshot.id,
    priceInr: snapshot.priceInr,
    bhk: snapshot.bhk,
    areaSqft: snapshot.areaSqft,
    verification: snapshot.verification,
    mediaCount: snapshot.mediaCount,
  };
}

function organizationOf(session: AuthSession): OrganizationSnapshot | null {
  const org = session.organization;
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    verificationStatus: org.verificationStatus,
    /* Until phone-verified sign-up lands there is no per-organization number
       on the session, so the demo organization is treated as verified. The
       publish gate still enforces the rule; this is where the real value will
       be read from once sign-up captures it. */
    businessPhoneE164: DEMO_BUSINESS_PHONE,
    businessPhoneVerifiedAt: DEMO_PHONE_VERIFIED_AT,
  };
}

/* Placeholder identity for the pre-phone-verification build. Replaced by the
   organization's real verified number when sign-up captures one. */
const DEMO_BUSINESS_PHONE = "+919876543210";
const DEMO_PHONE_VERIFIED_AT = new Date("2026-01-01T00:00:00Z");

async function listingSnapshotFor(listingId: string, session: AuthSession): Promise<ListingSnapshot | null> {
  const property = await getListingByIdForServer(listingId);
  return property ? propertyToListingSnapshot(property, session) : null;
}

/** Every listing this agency could offer, with the reason any cannot. */
export async function listOfferableListings(session: AuthSession) {
  const org = organizationOf(session);
  if (!org) return [];
  const properties = await getListingsForServer({ limit: 200 });
  return properties
    .map((property) => propertyToListingSnapshot(property, session))
    .filter((snapshot) => snapshot.brokerOrgId === org.id)
    .map((snapshot) => ({
      id: snapshot.id,
      lifecycle: snapshot.lifecycle,
      propertyType: snapshot.propertyType,
      priceInr: snapshot.priceInr,
      bhk: snapshot.bhk,
      areaSqft: snapshot.areaSqft,
      mediaCount: snapshot.mediaCount,
      verification: snapshot.verification,
      cityId: snapshot.cityId,
      localityId: snapshot.localityId,
      offerable: snapshot.lifecycle === "ACTIVE" && snapshot.mediaCount > 0,
    }));
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export type ChannelWriteResult<T> = { ok: true; data: T } | { ok: false; status: number; errors: string[] };

function storeFailure(error: unknown): { ok: false; status: number; errors: string[] } {
  if (error instanceof ChannelStoreError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "DUPLICATE_OPEN_SUPPLY" ? 409 : 400;
    return { ok: false, status, errors: [error.message] };
  }
  throw error;
}

export async function publishSupplyForServer(
  input: SupplyRequestInput,
  session: AuthSession,
  now = new Date(),
): Promise<ChannelWriteResult<StoredRequest>> {
  const org = organizationOf(session);
  if (!org) return { ok: false, status: 403, errors: ["Join or create an agency before using the channel."] };

  const listing = await listingSnapshotFor(input.listingId, session);
  const decision = decideSupplyPublish(input, org, listing);
  if (!decision.ok) return { ok: false, status: decision.status, errors: decision.errors };
  // decideSupplyPublish returns 404 when the listing is missing, so it exists here.
  const resolved = listing as ListingSnapshot;

  try {
    /* Search columns are copied from the listing rather than accepted from the
       client: the listing is authoritative, and a client-supplied city would
       let an offer advertise itself into the wrong market. */
    const request = createRequest(state(), {
      organizationId: org.id,
      createdByUserId: session.user.id,
      type: "SUPPLY",
      intent: input.intent,
      cityId: resolved.cityId,
      localityId: resolved.localityId,
      propertyType: resolved.propertyType,
      listingId: resolved.id,
      brokerNote: input.brokerNote ?? null,
      expiryDays: input.expiryDays,
    }, now);
    return { ok: true, data: request };
  } catch (error) {
    return storeFailure(error);
  }
}

export function publishDemandForServer(
  input: DemandRequestInput,
  session: AuthSession,
  now = new Date(),
): ChannelWriteResult<StoredRequest> {
  const org = organizationOf(session);
  if (!org) return { ok: false, status: 403, errors: ["Join or create an agency before using the channel."] };

  const decision = decideDemandPublish(input, org);
  if (!decision.ok) return { ok: false, status: decision.status, errors: decision.errors };

  try {
    const request = createRequest(state(), {
      organizationId: org.id,
      createdByUserId: session.user.id,
      type: "DEMAND",
      intent: input.intent,
      cityId: input.cityId,
      localityId: input.localityId ?? null,
      propertyType: input.propertyType,
      budgetMinInr: input.budgetMinInr ?? null,
      budgetMaxInr: input.budgetMaxInr ?? null,
      bhkMin: input.bhkMin ?? null,
      bhkMax: input.bhkMax ?? null,
      areaMinSqft: input.areaMinSqft ?? null,
      areaMaxSqft: input.areaMaxSqft ?? null,
      brokerNote: input.brokerNote ?? null,
      expiryDays: input.expiryDays,
    }, now);
    return { ok: true, data: request };
  } catch (error) {
    return storeFailure(error);
  }
}

export function closeRequestForServer(
  requestId: string,
  session: AuthSession,
  now = new Date(),
): ChannelWriteResult<StoredRequest> {
  const org = organizationOf(session);
  if (!org) return { ok: false, status: 403, errors: ["No agency on this session."] };
  try {
    return { ok: true, data: closeRequest(state(), requestId, org.id, now) };
  } catch (error) {
    return storeFailure(error);
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type ChannelRequestView = StoredRequest & { matchCount: number };

export function listMyRequestsForServer(session: AuthSession): ChannelRequestView[] {
  const org = organizationOf(session);
  if (!org) return [];
  const matches = listMatchesForOrg(state(), org.id);
  return listRequestsForOrg(state(), org.id).map((request) => ({
    ...request,
    matchCount: matches.filter(
      (m) => m.demandRequestId === request.id || m.supplyRequestId === request.id,
    ).length,
  }));
}

export type MatchView = {
  id: string;
  score: number;
  band: string;
  reasons: StoredMatch["reasons"];
  side: "DEMAND" | "SUPPLY";
  viewState: string;
  viewLabel: string;
  createdAt: Date;
  /** The counterparty's listing, when they are the supply side. */
  listing: {
    id: string;
    propertyType: string;
    priceInr: number;
    bhk: number | null;
    areaSqft: number | null;
    mediaCount: number;
    verification: string | null;
    /** Deep link to the public listing page: photos, RERA, locality. */
    href: string;
  } | null;
  /** The requirement being matched, when the counterparty is the demand side. */
  requirement: {
    budgetMinInr: number | null;
    budgetMaxInr: number | null;
    bhkMin: number | null;
    bhkMax: number | null;
    localityId: string | null;
    propertyType: string;
    brokerNote: string | null;
  } | null;
  contact: CounterpartyContact;
};

function bandOf(score: number): string {
  return score >= 80 ? "STRONG" : score >= 60 ? "GOOD" : score >= 40 ? "POSSIBLE" : "WEAK";
}

async function toMatchView(match: StoredMatch, organizationId: string, session: AuthSession): Promise<MatchView | null> {
  const side = sideFor(match, organizationId);
  const viewState = viewStateFor(match, organizationId);
  if (!side || !viewState) return null;

  const channel = state();
  const supplyRequest = channel.requests.get(match.supplyRequestId);
  const demandRequest = channel.requests.get(match.demandRequestId);

  /* The viewer sees the OTHER side's detail: a demand-side broker opens the
     listing, a supply-side broker reads the requirement. */
  let listing: MatchView["listing"] = null;
  if (side === "DEMAND" && supplyRequest?.listingId) {
    const snapshot = await listingSnapshotFor(supplyRequest.listingId, session);
    if (snapshot) {
      listing = {
        id: snapshot.id,
        propertyType: snapshot.propertyType,
        priceInr: snapshot.priceInr,
        bhk: snapshot.bhk,
        areaSqft: snapshot.areaSqft,
        mediaCount: snapshot.mediaCount,
        verification: snapshot.verification,
        href: `/property/${snapshot.id}`,
      };
    }
  }

  let requirement: MatchView["requirement"] = null;
  if (side === "SUPPLY" && demandRequest) {
    requirement = {
      budgetMinInr: demandRequest.budgetMinInr,
      budgetMaxInr: demandRequest.budgetMaxInr,
      bhkMin: demandRequest.bhkMin,
      bhkMax: demandRequest.bhkMax,
      localityId: demandRequest.localityId,
      propertyType: demandRequest.propertyType,
      brokerNote: demandRequest.brokerNote,
    };
  }

  /* The counterparty's identity. Its phone number is present only once both
     sides accepted -- counterpartyContact omits the field entirely otherwise,
     so nothing downstream has to remember to hide it. */
  const counterparty: OrganizationSnapshot = {
    id: side === "DEMAND" ? match.supplyOrganizationId : match.demandOrganizationId,
    name: side === "DEMAND" ? "Offering agency" : "Requiring agency",
    verificationStatus: "VERIFIED_PARTNER",
    businessPhoneE164: DEMO_BUSINESS_PHONE,
    businessPhoneVerifiedAt: DEMO_PHONE_VERIFIED_AT,
  };

  return {
    id: match.id,
    score: match.score,
    band: bandOf(match.score),
    reasons: match.reasons,
    side,
    viewState,
    viewLabel: describeViewState(viewState),
    createdAt: match.createdAt,
    listing,
    requirement,
    contact: counterpartyContact(counterparty, match),
  };
}

export async function listMyMatchesForServer(session: AuthSession): Promise<MatchView[]> {
  const org = organizationOf(session);
  if (!org) return [];
  const views = await Promise.all(
    listMatchesForOrg(state(), org.id).map((match) => toMatchView(match, org.id, session)),
  );
  return views.filter((view): view is MatchView => view !== null);
}

export async function getMatchForServer(matchId: string, session: AuthSession): Promise<MatchView | null> {
  const org = organizationOf(session);
  if (!org) return null;
  const match = getMatchForOrg(state(), matchId, org.id);
  return match ? toMatchView(match, org.id, session) : null;
}

export async function respondToMatchForServer(
  matchId: string,
  action: "accept" | "reject",
  session: AuthSession,
  now = new Date(),
): Promise<ChannelWriteResult<MatchView>> {
  const org = organizationOf(session);
  if (!org) return { ok: false, status: 403, errors: ["No agency on this session."] };

  const result = respondToMatch(state(), matchId, org.id, action, now);
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" || result.code === "NOT_A_PARTICIPANT" ? 404 : 409;
    return { ok: false, status, errors: [result.message] };
  }
  const view = await toMatchView(result.match, org.id, session);
  if (!view) return { ok: false, status: 404, errors: ["No such match."] };
  return { ok: true, data: view };
}

// ---------------------------------------------------------------------------
// Matcher and notifications
// ---------------------------------------------------------------------------

/* Run the matcher over current inventory.

   Invoked after a publish so a broker sees results immediately rather than
   waiting for a scheduler this deployment does not yet have. It is idempotent,
   which is what makes calling it on every publish safe. */
export async function runMatcherForServer(session: AuthSession, now = new Date()) {
  const properties = await getListingsForServer({ limit: 500 });
  const listings = new Map<string, ListingFacts>();
  for (const property of properties) {
    listings.set(property.id, listingFactsOf(propertyToListingSnapshot(property, session)));
  }
  return runMatcher(state(), listings, now);
}

export function listNotificationsForServer(session: AuthSession, unreadOnly = false) {
  const org = organizationOf(session);
  if (!org) return [];
  return listNotifications(state(), org.id, { unreadOnly });
}

export function markNotificationsReadForServer(session: AuthSession, ids: string[], now = new Date()) {
  const org = organizationOf(session);
  if (!org) return 0;
  return markNotificationsRead(state(), org.id, ids, now);
}
