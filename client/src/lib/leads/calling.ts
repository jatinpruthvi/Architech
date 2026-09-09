/* Broker calling domain logic — outcomes, stages, and the reveal gate.

   PROTOTYPE STAGE (Phase 3/4 of docs/leads/mobile-calling-implementation-plan.md).
   The gate shape here is the one that ships; the *inputs* are mocked until the
   encrypted-contact migration lands. Everything in this file is pure and
   server-safe so the same predicates run in the API and in tests.

   NORMATIVE SOURCE: docs/business-suite/mobile-calling-lead-workflow.md.
   Two rules from it are load-bearing and must not be "improved" away:

   1. §3 — a CALL OUTCOME is an activity, a LEAD STAGE is business progress.
      They are separate vocabularies with a mapping between them, because
      otherwise every unanswered dial reads as pipeline movement.

   2. §2 — the platform must not invent telephony evidence. A web page cannot
      know whether a cellular call connected, how long it ran, or whether it was
      recorded. So `CallOutcome` is SELF-REPORTED by the broker and there is no
      duration, no connected flag, and no recording reference anywhere in this
      module or in the LeadCallLog model. */

/* ------------------------------------------------------------------ *
 * 1. Vocabularies (workflow doc §3)
 * ------------------------------------------------------------------ */

export const CALL_OUTCOMES = [
  "CONNECTED_INTERESTED",
  "CONNECTED_FOLLOWUP",
  "CONNECTED_SITE_VISIT",
  "NO_ANSWER",
  "BUSY_CALL_LATER",
  "NOT_INTERESTED",
  "WRONG_OR_INVALID_NUMBER",
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  CONNECTED_INTERESTED: "Connected — interested",
  CONNECTED_FOLLOWUP: "Connected — follow-up required",
  CONNECTED_SITE_VISIT: "Connected — site visit scheduled",
  NO_ANSWER: "No answer",
  BUSY_CALL_LATER: "Busy / call later",
  NOT_INTERESTED: "Not interested",
  WRONG_OR_INVALID_NUMBER: "Wrong or invalid number",
};

/** Lead/deal stages, with the Real Estate profile's extra Site Visit step that
    §3 places between Qualified and Proposal. */
export const LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "SITE_VISIT",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  SITE_VISIT: "Site visit scheduled",
  PROPOSAL: "Proposal / quotation",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

/** Ordered so "at least Contacted" is a comparison, not a lookup table. */
const STAGE_RANK: Record<LeadStage, number> = {
  NEW: 0,
  CONTACTED: 1,
  QUALIFIED: 2,
  SITE_VISIT: 3,
  PROPOSAL: 4,
  NEGOTIATION: 5,
  WON: 6,
  LOST: 7,
};

export type StageEffect =
  /** Leave the stage exactly where it is. */
  | { kind: "keep" }
  /** Move to `stage`, but never backwards — a Won lead that gets one more
      "no answer" dial must not silently drop back to Contacted. */
  | { kind: "atLeast"; stage: LeadStage }
  | { kind: "set"; stage: LeadStage };

export type OutcomeRule = {
  effect: StageEffect;
  /** What the broker must supply before the log can be saved (§3 "required
      next action"). Kept as a discriminator so the UI can render the right
      field and the API can reject a log missing it. */
  requires: "NOTHING" | "RETRY_AT" | "FOLLOWUP_AT" | "NOTE_AND_FOLLOWUP" | "APPOINTMENT_AT" | "LOST_REASON";
  /** A DNC outcome permanently suppresses the number: the buyer said stop, or
      the number was never theirs. Suppression is not a retry cooldown. */
  suppressesContact: boolean;
};

/* The mapping table from §3, transcribed row for row. `atLeast` implements
   "Move at least to Contacted" — the doc's own wording, which matters because
   a lead already at Negotiation must not be dragged back down by one call. */
export const OUTCOME_RULES: Record<CallOutcome, OutcomeRule> = {
  NO_ANSWER: { effect: { kind: "keep" }, requires: "RETRY_AT", suppressesContact: false },
  BUSY_CALL_LATER: { effect: { kind: "keep" }, requires: "FOLLOWUP_AT", suppressesContact: false },
  CONNECTED_INTERESTED: { effect: { kind: "atLeast", stage: "CONTACTED" }, requires: "NOTE_AND_FOLLOWUP", suppressesContact: false },
  CONNECTED_FOLLOWUP: { effect: { kind: "atLeast", stage: "CONTACTED" }, requires: "NOTE_AND_FOLLOWUP", suppressesContact: false },
  CONNECTED_SITE_VISIT: { effect: { kind: "atLeast", stage: "SITE_VISIT" }, requires: "APPOINTMENT_AT", suppressesContact: false },
  NOT_INTERESTED: { effect: { kind: "set", stage: "LOST" }, requires: "LOST_REASON", suppressesContact: true },
  WRONG_OR_INVALID_NUMBER: { effect: { kind: "set", stage: "LOST" }, requires: "LOST_REASON", suppressesContact: true },
};

/** Apply an outcome to a stage. Pure: returns the next stage, mutates nothing. */
export function nextStageFor(current: LeadStage, outcome: CallOutcome): LeadStage {
  const rule = OUTCOME_RULES[outcome];
  switch (rule.effect.kind) {
    case "keep":
      return current;
    case "set":
      return rule.effect.stage;
    case "atLeast":
      return STAGE_RANK[current] >= STAGE_RANK[rule.effect.stage] ? current : rule.effect.stage;
  }
}

/* ------------------------------------------------------------------ *
 * 2. The broker plan gate
 * ------------------------------------------------------------------ */

/* DECISION D3 (08 Sep 2026): contact reveal is gated on the broker having an
   ACTIVATED plan. No plan model exists in prisma/schema.prisma yet, so these
   statuses are the proposed contract for it. `TRIAL` reveals because the point
   of a trial is to feel the product; `EXPIRED` stops revealing but must not
   delete data the broker already legitimately collected. */
export const PLAN_STATUSES = ["NONE", "TRIAL", "ACTIVE", "EXPIRED"] as const;
export type BrokerPlanStatus = (typeof PLAN_STATUSES)[number];

export function planAllowsReveal(status: BrokerPlanStatus): boolean {
  return status === "ACTIVE" || status === "TRIAL";
}

/* ------------------------------------------------------------------ *
 * 3. The reveal gate
 * ------------------------------------------------------------------ */

/** Deliberately shaped like `CounterpartyContact` in lib/channel/publish.ts,
    which already solves gated reveal for broker-to-broker contacts. Same rule:
    the masked form is ALWAYS present so the UI renders something honest before
    the gate opens, and the callable form appears only when every check passes. */
export const REVEAL_BLOCKED_REASONS = [
  "PLAN_REQUIRED",
  "NO_PERMISSION",
  "NOT_OWNED",
  "CONSENT_CLASS",
  "SUPPRESSED",
  "OUTSIDE_HOURS",
  "ATTEMPT_LIMIT",
  "NOT_STORED",
] as const;

export type RevealBlockedReason = (typeof REVEAL_BLOCKED_REASONS)[number];

/** Human-readable, broker-facing. Never exposes which internal check tripped in
    a way that would help someone probe the gate — but never lies either: a
    broker blocked by their own plan expiry needs to know that is the reason. */
export const REVEAL_BLOCKED_COPY: Record<RevealBlockedReason, { title: string; body: string; cta?: string }> = {
  PLAN_REQUIRED: {
    title: "Calling is part of a partner plan",
    body: "Activate a plan to reveal buyer numbers and call from this inbox. Until then enquiries stay masked.",
    cta: "View plans",
  },
  NO_PERMISSION: {
    title: "Your role cannot reveal contact details",
    body: "Only the assigned agent, their configured backup, or a manager may reveal a buyer's number.",
  },
  NOT_OWNED: { title: "This enquiry belongs to another partner", body: "It is not in your organization's inbox." },
  CONSENT_CLASS: {
    title: "This buyer did not consent to a call",
    body: "Their consent class does not permit a human first touch. Reply on the channel they did agree to.",
  },
  SUPPRESSED: {
    title: "This number is on the do-not-call list",
    body: "A previous call recorded the number as wrong, or the buyer asked not to be contacted. Suppression is permanent.",
  },
  OUTSIDE_HOURS: {
    title: "Outside permitted calling hours",
    body: "Calls are allowed 09:00–20:00 IST. Schedule a follow-up and the inbox will surface this lead at the right time.",
  },
  ATTEMPT_LIMIT: {
    title: "Attempt limit reached",
    body: "This lead has been dialled the maximum number of times without a recorded outcome. Log a result for the last attempt before calling again.",
  },
  NOT_STORED: {
    title: "Number not available for this enquiry",
    body: "This lead was captured before encrypted contact storage existed, so its number was never retained. Reply on the channel the buyer used.",
  },
};

export type RevealGateInput = {
  planStatus: BrokerPlanStatus;
  /** `lead.inbox.write`-class permission resolved from the verified session. */
  hasPermission: boolean;
  /** The lead belongs to the session's organization (assertLeadBelongsToOrg). */
  ownedBySessionOrg: boolean;
  /** `humanFirstTouch` from CONSENT_CLASSES — true for all seven classes today,
      but checked rather than assumed, because that is the whole point of the
      registry existing. */
  humanFirstTouch: boolean;
  suppressed: boolean;
  withinCallingHours: boolean;
  attemptsRemaining: boolean;
  /** False for leads created before the ciphertext migration. */
  contactStored: boolean;
};

export type RevealDecision = { ok: true } | { ok: false; reason: RevealBlockedReason };

/* Order is the contract: the CHEAPEST and most broker-relevant reason wins.

   Plan first, because it is the one the broker can act on commercially. Then
   ownership/permission, which are hard failures. Then the per-lead facts.
   `NOT_STORED` is last among the data checks but before nothing — a lead with
   no stored number is unwinnable regardless of plan, so it is checked before
   the transient gates (hours, attempts) that would only confuse the message. */
export function decideReveal(input: RevealGateInput): RevealDecision {
  if (!input.ownedBySessionOrg) return { ok: false, reason: "NOT_OWNED" };
  if (!input.hasPermission) return { ok: false, reason: "NO_PERMISSION" };
  if (!planAllowsReveal(input.planStatus)) return { ok: false, reason: "PLAN_REQUIRED" };
  if (!input.humanFirstTouch) return { ok: false, reason: "CONSENT_CLASS" };
  if (input.suppressed) return { ok: false, reason: "SUPPRESSED" };
  if (!input.contactStored) return { ok: false, reason: "NOT_STORED" };
  if (!input.withinCallingHours) return { ok: false, reason: "OUTSIDE_HOURS" };
  if (!input.attemptsRemaining) return { ok: false, reason: "ATTEMPT_LIMIT" };
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * 4. Calling hours (IST, explicitly — never server-local time)
 * ------------------------------------------------------------------ */

export type CallingHours = { startHour: number; startMinute: number; endHour: number; endMinute: number };

/** Parse "09:00-20:00". Returns null rather than guessing on malformed input —
    an unparseable window must fail CLOSED (no calling), not open. */
export function parseCallingHours(value: string | undefined): CallingHours | null {
  const match = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? "");
  if (!match) return null;
  const [, sh, sm, eh, em] = match;
  const startHour = Number(sh);
  const startMinute = Number(sm);
  const endHour = Number(eh);
  const endMinute = Number(em);
  const valid = (h: number, m: number) => h >= 0 && h <= 23 && m >= 0 && m <= 59;
  if (!valid(startHour, startMinute) || !valid(endHour, endMinute)) return null;
  return { startHour, startMinute, endHour, endMinute };
}

export const DEFAULT_CALLING_HOURS: CallingHours = { startHour: 9, startMinute: 0, endHour: 20, endMinute: 0 };

/** Minutes past midnight in IST for a given instant, computed from the epoch so
    it is correct regardless of the server's own timezone. */
export function istMinutesOfDay(at: Date): number {
  // IST is UTC+5:30 with no DST, so a fixed offset is exact, not an approximation.
  const shifted = new Date(at.getTime() + (5 * 60 + 30) * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function isWithinCallingHours(at: Date, hours: CallingHours = DEFAULT_CALLING_HOURS): boolean {
  const minutes = istMinutesOfDay(at);
  const start = hours.startHour * 60 + hours.startMinute;
  const end = hours.endHour * 60 + hours.endMinute;
  // A window like 21:00-06:00 wraps midnight; handle both shapes.
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}
