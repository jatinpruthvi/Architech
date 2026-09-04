/* In-memory channel store.

   The repository already runs in two modes: an in-memory data source for
   development and demos, and Prisma against PostgreSQL. Prisma's client cannot
   be generated in this environment (the engine download is blocked), so this
   adapter is what makes the channel runnable end to end today, and it doubles
   as the reference for the SQL adapter's behaviour.

   It is deliberately a faithful model rather than a stub: it enforces the same
   invariants the database enforces, including the two that matter most --
   a SUPPLY request must reference a listing, and a listing may carry only one
   live offer. Where this file and the migration disagree, the migration wins;
   the tests assert both say the same thing. */

import { matchDemandAgainstSupply, type DemandCriteria, type ScoredMatch, type SupplyCandidate } from "./matching";
import { acceptMatch, rejectMatch, type ChannelMatchStatus, type MatchRecord } from "./match-state";
import { defaultExpiry, type ChannelIntent, type ChannelRequestStatus, type ChannelRequestType } from "./request";

export type StoredRequest = {
  id: string;
  organizationId: string;
  createdByUserId: string | null;
  type: ChannelRequestType;
  intent: ChannelIntent;
  status: ChannelRequestStatus;
  listingId: string | null;
  cityId: string;
  localityId: string | null;
  propertyType: string;
  budgetMinInr: number | null;
  budgetMaxInr: number | null;
  bhkMin: number | null;
  bhkMax: number | null;
  areaMinSqft: number | null;
  areaMaxSqft: number | null;
  brokerNote: string | null;
  expiresAt: Date;
  publishedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredMatch = MatchRecord & {
  demandRequestId: string;
  supplyRequestId: string;
  score: number;
  reasons: ScoredMatch["reasons"];
  createdAt: Date;
  updatedAt: Date;
};

export type StoredNotification = {
  id: string;
  organizationId: string;
  matchId: string | null;
  kind: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
};

export type ChannelState = {
  requests: Map<string, StoredRequest>;
  matches: Map<string, StoredMatch>;
  notifications: Map<string, StoredNotification>;
  sequence: number;
};

export function createChannelState(): ChannelState {
  return { requests: new Map(), matches: new Map(), notifications: new Map(), sequence: 0 };
}

function nextId(state: ChannelState, prefix: string): string {
  state.sequence += 1;
  return `${prefix}_${state.sequence.toString(36).padStart(6, "0")}`;
}

export class ChannelStoreError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ChannelStoreError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Writing requests
// ---------------------------------------------------------------------------

export type CreateRequestInput = {
  organizationId: string;
  createdByUserId?: string | null;
  type: ChannelRequestType;
  intent: ChannelIntent;
  cityId: string;
  localityId?: string | null;
  propertyType: string;
  listingId?: string | null;
  budgetMinInr?: number | null;
  budgetMaxInr?: number | null;
  bhkMin?: number | null;
  bhkMax?: number | null;
  areaMinSqft?: number | null;
  areaMaxSqft?: number | null;
  brokerNote?: string | null;
  expiryDays?: number;
  /** Publish immediately, or leave as a draft the broker can finish later. */
  publish?: boolean;
};

/* Mirrors the database CHECK constraints. These are re-asserted here because
   the in-memory mode has no PostgreSQL behind it, and a rule enforced in only
   one of the two modes is a rule that will eventually be violated in the other. */
function assertShape(input: CreateRequestInput) {
  if (input.type === "SUPPLY" && !input.listingId) {
    throw new ChannelStoreError("SUPPLY_REQUIRES_LISTING", "A supply request must reference a listing.");
  }
  if (input.type === "DEMAND" && input.listingId) {
    throw new ChannelStoreError("DEMAND_MUST_NOT_HAVE_LISTING", "A demand request must not reference a listing.");
  }
  if (input.type === "SUPPLY" && (input.budgetMinInr != null || input.budgetMaxInr != null)) {
    throw new ChannelStoreError("BUDGET_IS_DEMAND_ONLY", "Budget belongs to demand; the listing owns the price.");
  }
}

/* One live offer per listing, matching the partial unique index. Without it a
   broker could republish the same flat until they own the whole inbox. */
function assertNoDuplicateSupply(state: ChannelState, input: CreateRequestInput, publish: boolean) {
  if (input.type !== "SUPPLY" || !input.listingId || !publish) return;
  for (const existing of state.requests.values()) {
    if (
      existing.listingId === input.listingId &&
      (existing.status === "OPEN" || existing.status === "MATCHED")
    ) {
      throw new ChannelStoreError(
        "DUPLICATE_OPEN_SUPPLY",
        "This listing is already offered on the channel. Close the existing offer first.",
      );
    }
  }
}

export function createRequest(state: ChannelState, input: CreateRequestInput, now: Date): StoredRequest {
  assertShape(input);
  const publish = input.publish !== false;
  assertNoDuplicateSupply(state, input, publish);

  const record: StoredRequest = {
    id: nextId(state, "chreq"),
    organizationId: input.organizationId,
    createdByUserId: input.createdByUserId ?? null,
    type: input.type,
    intent: input.intent,
    status: publish ? "OPEN" : "DRAFT",
    listingId: input.listingId ?? null,
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
    expiresAt: defaultExpiry(now, input.expiryDays),
    publishedAt: publish ? now : null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  state.requests.set(record.id, record);
  return record;
}

/** Requests owned by one agency, newest first. */
export function listRequestsForOrg(state: ChannelState, organizationId: string): StoredRequest[] {
  return [...state.requests.values()]
    .filter((r) => r.organizationId === organizationId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
}

export function getRequest(state: ChannelState, id: string): StoredRequest | null {
  return state.requests.get(id) ?? null;
}

/* Close a request. Owner-only: the check lives here rather than in the route so
   it cannot be forgotten by a second caller. */
export function closeRequest(
  state: ChannelState,
  id: string,
  organizationId: string,
  now: Date,
): StoredRequest {
  const request = state.requests.get(id);
  if (!request || request.organizationId !== organizationId) {
    throw new ChannelStoreError("NOT_FOUND", "No such request.");
  }
  if (request.status === "CLOSED" || request.status === "CANCELLED") return request;
  request.status = request.publishedAt ? "CLOSED" : "CANCELLED";
  request.closedAt = now;
  request.updatedAt = now;
  return request;
}

/* Expire everything past its date. Called by the matcher run so an unattended
   deployment still ages out stale demand without a separate cron. */
export function expireStaleRequests(state: ChannelState, now: Date): number {
  let expired = 0;
  for (const request of state.requests.values()) {
    if ((request.status === "OPEN" || request.status === "MATCHED") && request.expiresAt <= now) {
      request.status = "EXPIRED";
      request.updatedAt = now;
      expired += 1;
    }
  }
  return expired;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Everything the matcher needs about a listing, supplied by the caller. */
export type ListingFacts = {
  id: string;
  priceInr: number;
  bhk: number | null;
  areaSqft: number | null;
  verification: string | null;
  mediaCount: number;
};

function toDemandCriteria(request: StoredRequest): DemandCriteria {
  return {
    requestId: request.id,
    organizationId: request.organizationId,
    intent: request.intent,
    cityId: request.cityId,
    localityId: request.localityId,
    propertyType: request.propertyType,
    budgetMinInr: request.budgetMinInr,
    budgetMaxInr: request.budgetMaxInr,
    bhkMin: request.bhkMin,
    bhkMax: request.bhkMax,
    areaMinSqft: request.areaMinSqft,
    areaMaxSqft: request.areaMaxSqft,
    createdAt: request.createdAt,
  };
}

function toSupplyCandidate(request: StoredRequest, listing: ListingFacts): SupplyCandidate {
  return {
    requestId: request.id,
    organizationId: request.organizationId,
    listingId: listing.id,
    intent: request.intent,
    cityId: request.cityId,
    localityId: request.localityId,
    propertyType: request.propertyType,
    priceInr: listing.priceInr,
    bhk: listing.bhk,
    areaSqft: listing.areaSqft,
    verification: listing.verification,
    mediaCount: listing.mediaCount,
    createdAt: request.publishedAt ?? request.createdAt,
  };
}

export type MatcherResult = {
  created: number;
  updated: number;
  expired: number;
  notified: number;
};

/* Run the matcher across every open request.

   Idempotent by design: a pairing that already exists is UPDATED with the new
   score rather than duplicated, mirroring the unique index on
   (demandRequestId, supplyRequestId). Re-running must be safe, because it is
   the only way to pick up a listing whose price changed.

   A match that either side has already answered is left completely alone --
   rescoring an accepted match, or worse resurrecting a rejected one, would
   undo a decision a human made. */
export function runMatcher(
  state: ChannelState,
  listings: Map<string, ListingFacts>,
  now: Date,
): MatcherResult {
  const expired = expireStaleRequests(state, now);
  const open = [...state.requests.values()].filter((r) => r.status === "OPEN" || r.status === "MATCHED");
  const demands = open.filter((r) => r.type === "DEMAND");
  const supplies = open.filter((r) => r.type === "SUPPLY");

  let created = 0;
  let updated = 0;
  let notified = 0;

  for (const demand of demands) {
    const candidates: SupplyCandidate[] = [];
    for (const supply of supplies) {
      const listing = supply.listingId ? listings.get(supply.listingId) : undefined;
      // A supply row whose listing has vanished is skipped, not scored as zero.
      if (!listing) continue;
      candidates.push(toSupplyCandidate(supply, listing));
    }

    const scored = matchDemandAgainstSupply(toDemandCriteria(demand), candidates, now);

    for (const result of scored) {
      const existing = findMatch(state, demand.id, result.supplyRequestId);

      if (existing) {
        if (existing.demandAcceptedAt || existing.supplyAcceptedAt || existing.rejectedAt) continue;
        if (existing.score !== result.score) {
          existing.score = result.score;
          existing.reasons = result.reasons;
          existing.updatedAt = now;
          updated += 1;
        }
        continue;
      }

      const supplyRequest = state.requests.get(result.supplyRequestId);
      if (!supplyRequest) continue;

      const match: StoredMatch = {
        id: nextId(state, "chmat"),
        demandRequestId: demand.id,
        supplyRequestId: result.supplyRequestId,
        demandOrganizationId: demand.organizationId,
        supplyOrganizationId: supplyRequest.organizationId,
        score: result.score,
        reasons: result.reasons,
        status: "SUGGESTED",
        demandAcceptedAt: null,
        supplyAcceptedAt: null,
        rejectedAt: null,
        rejectedByOrgId: null,
        connectedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      state.matches.set(match.id, match);
      created += 1;

      /* Both sides are told, because either may act first. In-app only: the v8
         decision keeps WhatsApp and email out of channel events. */
      notify(state, demand.organizationId, match.id, "MATCH_SUGGESTED",
        "New match for your requirement",
        `A ${result.band.toLowerCase()} match scored ${result.score}. Review the listing to respond.`, now);
      notify(state, supplyRequest.organizationId, match.id, "MATCH_SUGGESTED",
        "A broker is looking for your listing",
        `A ${result.band.toLowerCase()} match scored ${result.score}. Review the requirement to respond.`, now);
      notified += 2;

      for (const request of [demand, supplyRequest]) {
        if (request.status === "OPEN") {
          request.status = "MATCHED";
          request.updatedAt = now;
        }
      }
    }
  }

  return { created, updated, expired, notified };
}

export function findMatch(state: ChannelState, demandRequestId: string, supplyRequestId: string): StoredMatch | null {
  for (const match of state.matches.values()) {
    if (match.demandRequestId === demandRequestId && match.supplyRequestId === supplyRequestId) return match;
  }
  return null;
}

/** Matches an agency participates in, strongest first. */
export function listMatchesForOrg(state: ChannelState, organizationId: string): StoredMatch[] {
  return [...state.matches.values()]
    .filter((m) => m.demandOrganizationId === organizationId || m.supplyOrganizationId === organizationId)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function getMatchForOrg(state: ChannelState, matchId: string, organizationId: string): StoredMatch | null {
  const match = state.matches.get(matchId);
  if (!match) return null;
  /* An outsider gets null rather than a 403: a 403 would confirm the match
     exists, which is itself information about two other agencies. */
  if (match.demandOrganizationId !== organizationId && match.supplyOrganizationId !== organizationId) return null;
  return match;
}

export type RespondResult =
  | { ok: true; match: StoredMatch; connected: boolean }
  | { ok: false; code: string; message: string };

const ACTION_MESSAGES: Record<string, string> = {
  NOT_A_PARTICIPANT: "No such match.",
  ALREADY_REJECTED: "This match was already declined.",
  ALREADY_ACCEPTED: "You have already responded to this match.",
  MATCH_EXPIRED: "This match has expired.",
};

export function respondToMatch(
  state: ChannelState,
  matchId: string,
  organizationId: string,
  action: "accept" | "reject",
  now: Date,
): RespondResult {
  const match = state.matches.get(matchId);
  if (!match) return { ok: false, code: "NOT_FOUND", message: "No such match." };

  const decision = action === "accept"
    ? acceptMatch(match, organizationId, now)
    : rejectMatch(match, organizationId, now);

  if (!decision.ok) {
    return { ok: false, code: decision.failure, message: ACTION_MESSAGES[decision.failure] ?? "Cannot respond." };
  }

  Object.assign(match, decision.changes, { updatedAt: now });

  const other = match.demandOrganizationId === organizationId
    ? match.supplyOrganizationId
    : match.demandOrganizationId;

  if (decision.connected) {
    /* Both sides are notified of the connection, including the side that just
       clicked: their own screen may be stale, and the number is what they are
       waiting for. */
    for (const org of [organizationId, other]) {
      notify(state, org, match.id, "MATCH_CONNECTED", "Contact details unlocked",
        "Both agencies accepted. You can now call the counterparty directly.", now);
    }
  } else if (action === "accept") {
    notify(state, other, match.id, "MATCH_ACCEPTED", "An agency accepted your match",
      "Accept to exchange contact details and take it forward.", now);
  } else {
    notify(state, other, match.id, "MATCH_REJECTED", "A match was declined",
      "The other agency declined this match.", now);
  }

  return { ok: true, match, connected: decision.connected };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function notify(
  state: ChannelState,
  organizationId: string,
  matchId: string | null,
  kind: string,
  title: string,
  body: string,
  now: Date,
): StoredNotification {
  const record: StoredNotification = {
    id: nextId(state, "chnot"),
    organizationId,
    matchId,
    kind,
    title,
    body,
    readAt: null,
    createdAt: now,
  };
  state.notifications.set(record.id, record);
  return record;
}

export function listNotifications(
  state: ChannelState,
  organizationId: string,
  options: { unreadOnly?: boolean } = {},
): StoredNotification[] {
  return [...state.notifications.values()]
    .filter((n) => n.organizationId === organizationId && (!options.unreadOnly || n.readAt === null))
    /* Ties break on id, which is sequential, so two notifications written in
       the same millisecond still order newest-first. Sorting on the timestamp
       alone left "latest" arbitrary, which showed the wrong headline. */
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
}

export function markNotificationsRead(state: ChannelState, organizationId: string, ids: string[], now: Date): number {
  let marked = 0;
  for (const id of ids) {
    const notification = state.notifications.get(id);
    // Silently skips another agency's ids rather than reporting them.
    if (!notification || notification.organizationId !== organizationId || notification.readAt) continue;
    notification.readAt = now;
    marked += 1;
  }
  return marked;
}

export function matchStatusOf(match: StoredMatch): ChannelMatchStatus {
  return match.status;
}
