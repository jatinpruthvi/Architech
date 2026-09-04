/* Validation and lifecycle for channel requests.

   Pure functions over plain data: no Prisma, no `server-only`. The storage
   adapter and the API routes both call into here, which is what lets the whole
   ruleset be tested without a database.

   The database CHECK constraints in 202609030006 are the real enforcement --
   these functions exist so a broker gets a readable message instead of a
   constraint violation, not as a substitute for them. */

import { checkDemandPublish, checkSupplyPublish, type ListingSnapshot, type OrganizationSnapshot, type PublishCheck } from "./publish";

export type ChannelRequestType = "DEMAND" | "SUPPLY";
export type ChannelIntent = "BUY" | "RENT";
export type ChannelRequestStatus = "DRAFT" | "OPEN" | "MATCHED" | "CLOSED" | "CANCELLED" | "EXPIRED";

/** Requests expire so the channel does not fill with demand nobody withdrew. */
export const DEFAULT_EXPIRY_DAYS = 30;
export const MAX_EXPIRY_DAYS = 90;
export const BROKER_NOTE_MAX = 500;

export function defaultExpiry(now: Date, days = DEFAULT_EXPIRY_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/* Statuses at which a request is visible to other agencies and eligible for
   matching. DRAFT is deliberately excluded: a half-written request must not be
   discoverable, which is also asserted in the RLS policy. */
export const DISCOVERABLE_STATUSES: ChannelRequestStatus[] = ["OPEN", "MATCHED"];

export function isDiscoverable(status: ChannelRequestStatus): boolean {
  return DISCOVERABLE_STATUSES.includes(status);
}

/* Terminal statuses. A request here can never move again -- reopening would
   resurrect matches whose counterparty has moved on, so the broker publishes a
   fresh request instead. */
const TERMINAL: ChannelRequestStatus[] = ["CLOSED", "CANCELLED", "EXPIRED"];

export function isTerminal(status: ChannelRequestStatus): boolean {
  return TERMINAL.includes(status);
}

const TRANSITIONS: Record<ChannelRequestStatus, ChannelRequestStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["MATCHED", "CLOSED", "CANCELLED", "EXPIRED"],
  /* MATCHED can fall back to OPEN: if every match is rejected the request is
     live again rather than stuck looking busy. */
  MATCHED: ["OPEN", "CLOSED", "CANCELLED", "EXPIRED"],
  CLOSED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransition(from: ChannelRequestStatus, to: ChannelRequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

export type DemandRequestInput = {
  intent: ChannelIntent;
  cityId: string;
  localityId?: string | null;
  propertyType: string;
  budgetMinInr?: number | null;
  budgetMaxInr?: number | null;
  bhkMin?: number | null;
  bhkMax?: number | null;
  areaMinSqft?: number | null;
  areaMaxSqft?: number | null;
  brokerNote?: string | null;
  expiryDays?: number;
};

export type SupplyRequestInput = {
  intent: ChannelIntent;
  listingId: string;
  brokerNote?: string | null;
  expiryDays?: number;
};

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

const INTENTS: ChannelIntent[] = ["BUY", "RENT"];

/* A range where only one end is given is legitimate ("up to 1.2 Cr", "3 BHK
   and above"); a range where min exceeds max is a typo that would silently
   match nothing, so it is rejected rather than swapped. Swapping would be
   guessing at intent. */
function checkRange(
  label: string,
  min: number | null | undefined,
  max: number | null | undefined,
  errors: string[],
) {
  for (const [bound, value] of [["minimum", min], ["maximum", max]] as const) {
    if (value == null) continue;
    if (!Number.isFinite(value) || value < 0) errors.push(`${label} ${bound} must be a positive number.`);
  }
  if (min != null && max != null && Number.isFinite(min) && Number.isFinite(max) && min > max) {
    errors.push(`${label} minimum cannot be greater than its maximum.`);
  }
}

function checkCommon(
  input: { intent: ChannelIntent; brokerNote?: string | null; expiryDays?: number },
  errors: string[],
) {
  if (!INTENTS.includes(input.intent)) errors.push("Intent must be BUY or RENT.");
  if (input.brokerNote && input.brokerNote.length > BROKER_NOTE_MAX) {
    errors.push(`Note must be ${BROKER_NOTE_MAX} characters or fewer.`);
  }
  if (input.expiryDays != null) {
    if (!Number.isInteger(input.expiryDays) || input.expiryDays < 1 || input.expiryDays > MAX_EXPIRY_DAYS) {
      errors.push(`Expiry must be between 1 and ${MAX_EXPIRY_DAYS} days.`);
    }
  }
}

export function validateDemandInput(input: DemandRequestInput): ValidationResult {
  const errors: string[] = [];
  checkCommon(input, errors);
  if (!input.cityId) errors.push("City is required.");
  if (!input.propertyType) errors.push("Property type is required.");
  checkRange("Budget", input.budgetMinInr, input.budgetMaxInr, errors);
  checkRange("BHK", input.bhkMin, input.bhkMax, errors);
  checkRange("Area", input.areaMinSqft, input.areaMaxSqft, errors);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateSupplyInput(input: SupplyRequestInput): ValidationResult {
  const errors: string[] = [];
  checkCommon(input, errors);
  if (!input.listingId) errors.push("A listing is required to offer inventory.");
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// ---------------------------------------------------------------------------
// Failure codes to broker-readable messages
// ---------------------------------------------------------------------------

/* Every message names the fix. "ORG_NOT_VERIFIED" tells a broker nothing;
   "complete verification to trade" tells them where to go. */
const FAILURE_MESSAGES: Record<string, string> = {
  ORG_NOT_VERIFIED: "Your agency must be a verified partner to trade on the channel. Complete verification first.",
  ORG_HAS_NO_VERIFIED_PHONE: "Add and verify your agency's business phone number before publishing.",
  LISTING_REQUIRED_FOR_SUPPLY: "Choose one of your listings to offer.",
  LISTING_NOT_OWNED_BY_ORG: "You can only offer listings your agency represents.",
  LISTING_NOT_ACTIVE: "This listing is not live yet. Publish it to the site before offering it on the channel.",
  LISTING_HAS_NO_PHOTOS: "Add at least one photo to the listing. Brokers will not act on an offer they cannot see.",
  DEMAND_MUST_NOT_HAVE_LISTING: "A requirement describes what your buyer wants; it does not reference a listing.",
  DEMAND_REQUIRES_BUDGET: "Give a maximum budget so the matcher can score offers against it.",
  NOTE_CONTAINS_CONTACT_DETAILS:
    "Remove phone numbers, emails and contact instructions from the note. Contact is exchanged only after both sides accept.",
};

export function describeFailure(code: string): string {
  return FAILURE_MESSAGES[code] ?? "This request cannot be published.";
}

export function describeFailures(check: PublishCheck): string[] {
  return check.ok ? [] : check.failures.map(describeFailure);
}

// ---------------------------------------------------------------------------
// Full publish decision
// ---------------------------------------------------------------------------

export type PublishDecision = { ok: true } | { ok: false; status: number; errors: string[] };

/* Shape validation first, then the publish gates.

   Ordering matters for the message quality: telling someone their agency is
   unverified while they also left the budget blank is two unrelated problems in
   one toast. Shape errors are the ones they can fix in the form, so they are
   reported alone when present. */
export function decideDemandPublish(
  input: DemandRequestInput,
  organization: OrganizationSnapshot,
): PublishDecision {
  const shape = validateDemandInput(input);
  if (!shape.ok) return { ok: false, status: 400, errors: shape.errors };

  const gate = checkDemandPublish({
    organization,
    budgetMaxInr: input.budgetMaxInr ?? null,
    brokerNote: input.brokerNote ?? null,
  });
  if (gate.ok) return { ok: true };

  /* 403 when the agency itself is not allowed to trade, 400 when the request
     is fixable. A broker who is not verified should not see "bad request". */
  const isAuthz = gate.failures.some((f) => f === "ORG_NOT_VERIFIED" || f === "ORG_HAS_NO_VERIFIED_PHONE");
  return { ok: false, status: isAuthz ? 403 : 400, errors: describeFailures(gate) };
}

export function decideSupplyPublish(
  input: SupplyRequestInput,
  organization: OrganizationSnapshot,
  listing: ListingSnapshot | null,
): PublishDecision {
  const shape = validateSupplyInput(input);
  if (!shape.ok) return { ok: false, status: 400, errors: shape.errors };

  /* A missing listing is reported as "not found" rather than "not yours", so
     the channel cannot be used to probe which listing ids exist. */
  if (!listing) return { ok: false, status: 404, errors: [describeFailure("LISTING_NOT_OWNED_BY_ORG")] };

  const gate = checkSupplyPublish({ organization, listing, brokerNote: input.brokerNote ?? null });
  if (gate.ok) return { ok: true };

  const isAuthz = gate.failures.some(
    (f) => f === "ORG_NOT_VERIFIED" || f === "ORG_HAS_NO_VERIFIED_PHONE" || f === "LISTING_NOT_OWNED_BY_ORG",
  );
  return { ok: false, status: isAuthz ? 403 : 400, errors: describeFailures(gate) };
}
