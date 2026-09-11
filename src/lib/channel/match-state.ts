/* The accept/reject state machine for a match.

   This is the part of the channel that decides when two agencies' phone
   numbers become visible to each other, so it is written as pure transitions
   over plain data and tested exhaustively.

   THE RULE: contact is mutual. Each side accepts independently, and the
   connection -- with it, the phone number -- exists only once BOTH have. A
   single accept reveals nothing at all, which is what stops the channel from
   being scraped by an agency that accepts everything.

   Either side may reject at any point before connection, and rejection is
   final: it kills the pairing rather than returning it to the inbox, because a
   match that keeps reappearing after being declined is a nuisance that trains
   brokers to ignore the inbox. */

import { isConnected, type MatchAcceptanceState } from "./publish";

export type ChannelMatchStatus = "SUGGESTED" | "ACCEPTED" | "CONNECTED" | "REJECTED" | "EXPIRED";

/** Which end of the pairing an organization sits on. */
export type MatchSide = "DEMAND" | "SUPPLY";

export type MatchRecord = MatchAcceptanceState & {
  id: string;
  demandOrganizationId: string;
  supplyOrganizationId: string;
  status: ChannelMatchStatus;
  connectedAt: Date | null;
  rejectedByOrgId: string | null;
};

/* Which side is this organization on?

   Returns null for an organization that is party to neither, which the caller
   must treat as "no such match" rather than "forbidden": RLS already hides
   other agencies' matches, and a 403 here would confirm the row exists. */
export function sideFor(match: MatchRecord, organizationId: string): MatchSide | null {
  if (match.demandOrganizationId === organizationId) return "DEMAND";
  if (match.supplyOrganizationId === organizationId) return "SUPPLY";
  return null;
}

export function hasAccepted(match: MatchRecord, side: MatchSide): boolean {
  return side === "DEMAND" ? match.demandAcceptedAt !== null : match.supplyAcceptedAt !== null;
}

export type MatchActionFailure =
  | "NOT_A_PARTICIPANT"
  | "ALREADY_REJECTED"
  | "ALREADY_ACCEPTED"
  | "MATCH_EXPIRED";

export type MatchActionResult =
  | { ok: true; changes: Partial<MatchRecord>; connected: boolean }
  | { ok: false; failure: MatchActionFailure };

/* Accept one side of a match.

   Returns the field changes to persist rather than mutating, so the caller
   applies them inside its own transaction and the decision stays testable
   without a database. */
export function acceptMatch(match: MatchRecord, organizationId: string, now: Date): MatchActionResult {
  const side = sideFor(match, organizationId);
  if (!side) return { ok: false, failure: "NOT_A_PARTICIPANT" };
  if (match.rejectedAt) return { ok: false, failure: "ALREADY_REJECTED" };
  if (match.status === "EXPIRED") return { ok: false, failure: "MATCH_EXPIRED" };
  if (hasAccepted(match, side)) return { ok: false, failure: "ALREADY_ACCEPTED" };

  const changes: Partial<MatchRecord> =
    side === "DEMAND" ? { demandAcceptedAt: now } : { supplyAcceptedAt: now };

  /* Evaluate the connection against the state as it WILL be, not as it is.
     Reading the stale record here was the obvious bug: the second accept would
     look one-sided and the pair would never connect. */
  const next: MatchAcceptanceState = {
    demandAcceptedAt: changes.demandAcceptedAt ?? match.demandAcceptedAt,
    supplyAcceptedAt: changes.supplyAcceptedAt ?? match.supplyAcceptedAt,
    rejectedAt: null,
  };

  if (isConnected(next)) {
    return { ok: true, changes: { ...changes, status: "CONNECTED", connectedAt: now }, connected: true };
  }
  return { ok: true, changes: { ...changes, status: "ACCEPTED" }, connected: false };
}

/* Reject a match from one side.

   Permitted even after the other side accepted -- an agency that changes its
   mind must not be held to a connection it no longer wants. Rejecting after
   BOTH accepted is refused: the numbers have already been exchanged, so
   "unrejecting" the disclosure is not something this system can honestly
   offer, and pretending otherwise would be worse than declining the action. */
export function rejectMatch(match: MatchRecord, organizationId: string, now: Date): MatchActionResult {
  const side = sideFor(match, organizationId);
  if (!side) return { ok: false, failure: "NOT_A_PARTICIPANT" };
  if (match.rejectedAt) return { ok: false, failure: "ALREADY_REJECTED" };
  if (isConnected(match)) return { ok: false, failure: "ALREADY_ACCEPTED" };

  return {
    ok: true,
    changes: { rejectedAt: now, rejectedByOrgId: organizationId, status: "REJECTED" },
    connected: false,
  };
}

/* What the viewing agency should be shown for this match right now. */
export type MatchViewState = "AWAITING_YOU" | "AWAITING_THEM" | "CONNECTED" | "REJECTED" | "EXPIRED";

export function viewStateFor(match: MatchRecord, organizationId: string): MatchViewState | null {
  const side = sideFor(match, organizationId);
  if (!side) return null;
  if (match.rejectedAt) return "REJECTED";
  if (match.status === "EXPIRED") return "EXPIRED";
  if (isConnected(match)) return "CONNECTED";
  return hasAccepted(match, side) ? "AWAITING_THEM" : "AWAITING_YOU";
}

const VIEW_LABELS: Record<MatchViewState, string> = {
  AWAITING_YOU: "Awaiting your response",
  AWAITING_THEM: "Waiting for the other agency",
  CONNECTED: "Connected — contact shared",
  REJECTED: "Declined",
  EXPIRED: "Expired",
};

export function describeViewState(state: MatchViewState): string {
  return VIEW_LABELS[state];
}
