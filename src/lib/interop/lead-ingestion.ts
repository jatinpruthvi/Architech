/* Lead ingestion contract — the one schema every lead source normalizes to.
 *
 * WHY THIS MODULE EXISTS
 *
 * Leads arrive from wildly different surfaces: real-estate property
 * portals (push or pull), B2B aggregators (IndiaMart/JustDial/TradeIndia),
 * ad lead-forms (Meta/Google), the business's own website, Architech's
 * public enquiry flow, walk-ins, CSV backlog imports and
 * email parsing. Every one of them must become the SAME internal lead before
 * it touches the CRM, because:
 *
 *   1. Dedupe is a cross-source problem. The same buyer enquires on three
 *      portals the same evening; only a canonical key (E.164 mobile) makes
 *      them one lead with three sources instead of three competing records.
 *   2. Consent is a per-source fact. A portal-shared lead and a
 *      first-party-form lead carry DIFFERENT contact permissions, and the
 *      difference must be decided at ingestion (where the evidence is) --
 *      never at send time (where the damage is).
 *   3. Frappe CRM's `CRM Lead.source` is a Link to a `CRM Lead Source`
 *      doctype (frappe/crm v1.83.0, crm_lead.json), i.e. a curated list.
 *      The taxonomy below is that list, so portal leads are attributable in
 *      reports without free-text drift.
 *
 * This module is the normative TypeScript definition. The Frappe-side
 * implementation (business_suite_core) mirrors it in Python; the design doc is
 * docs/business-suite/lead-ingestion-contract.md. Keeping the reference
 * implementation here means Architech's own outbound lead projection emits the
 * same vocabulary it will later receive from partners.
 *
 * BOUNDS: every human-visible string is bounded to Frappe's varchar(140)
 * (FRAPPE_DATA_MAX) so nothing silently truncates on the receiving side --
 * the same discipline as idempotency.ts.
 */

import { FRAPPE_DATA_MAX, buildIdempotencyKey } from "./idempotency";
import { normalizeIndianPhone } from "./phone";

/** Bump when the schema shape changes; adapters re-verify against the new version. */
export const LEAD_INGESTION_CONTRACT_VERSION = 1;

/* ------------------------------------------------------------------ *
 * 1. Source taxonomy
 * ------------------------------------------------------------------ */

export type LeadMedium =
  | "owned-web"
  | "messaging"
  | "offline"
  | "portal"
  | "aggregator"
  | "paid-social"
  | "search-ads"
  | "import";

export type LeadChannelClass = "digital-owned" | "digital-paid" | "third-party-shared" | "offline" | "import";

export type LeadSourceDefinition = {
  label: string;
  medium: LeadMedium;
  channelClass: LeadChannelClass;
};

/* The canonical source registry. IDs are stable, lowercase, hyphenated --
   they become `CRM Lead Source` titles on the Frappe site and `source` values
   in every report, so adding one is a contract change, not a typo fix. */
export const LEAD_SOURCES = {
  "architech-website": { label: "Architech Website", medium: "owned-web", channelClass: "digital-owned" },
  "website-form": { label: "Website Form", medium: "owned-web", channelClass: "digital-owned" },
  whatsapp: { label: "WhatsApp Inbound", medium: "messaging", channelClass: "digital-owned" },
  walkin: { label: "Walk-in", medium: "offline", channelClass: "offline" },
  referral: { label: "Referral", medium: "offline", channelClass: "offline" },
  /* Property-portal sources are deliberately anonymous here. This module
     ships in a build, and shipped code must describe the capability, never a
     rival portal's brand (see the competitor-names guard). The id-to-portal
     mapping, and the trade-name display titles provisioned as site data by
     business_suite_core, live in docs/business-suite/lead-ingestion-contract.md
     §1. Ordinals follow the Phase-4 integration order; the ids are frozen
     from the moment the first site provisions them. */
  "property-portal-1": { label: "Property Portal 1", medium: "portal", channelClass: "third-party-shared" },
  "property-portal-2": { label: "Property Portal 2", medium: "portal", channelClass: "third-party-shared" },
  "property-portal-3": { label: "Property Portal 3", medium: "portal", channelClass: "third-party-shared" },
  "property-portal-4": { label: "Property Portal 4", medium: "portal", channelClass: "third-party-shared" },
  "property-portal-5": { label: "Property Portal 5", medium: "portal", channelClass: "third-party-shared" },
  "property-portal-6": { label: "Property Portal 6", medium: "portal", channelClass: "third-party-shared" },
  "property-portal-7": { label: "Property Portal 7", medium: "portal", channelClass: "third-party-shared" },
  indiamart: { label: "IndiaMart", medium: "aggregator", channelClass: "third-party-shared" },
  justdial: { label: "JustDial", medium: "aggregator", channelClass: "third-party-shared" },
  tradeindia: { label: "TradeIndia", medium: "aggregator", channelClass: "third-party-shared" },
  "meta-ads": { label: "Meta Lead Ads", medium: "paid-social", channelClass: "digital-paid" },
  "google-ads": { label: "Google Lead Forms", medium: "search-ads", channelClass: "digital-paid" },
  "csv-import": { label: "CSV Import", medium: "import", channelClass: "import" },
  "email-parse": { label: "Email Parse", medium: "import", channelClass: "import" },
  manual: { label: "Manual Entry", medium: "import", channelClass: "import" },
} as const satisfies Record<string, LeadSourceDefinition>;

export type LeadSourceId = keyof typeof LEAD_SOURCES;

/* ------------------------------------------------------------------ *
 * 2. Consent provenance classes
 * ------------------------------------------------------------------ */

export type ConsentClassId =
  | "first-party-form"
  | "ad-opt-in"
  | "portal-shared"
  | "aggregator-shared"
  | "walk-in-verbal"
  | "referral-verbal"
  | "imported-unknown";

export type ConsentPermissions = {
  /** An employee may contact the lead (WhatsApp tab / Call from SIM). */
  humanFirstTouch: boolean;
  /** The automated first-message worker may send without a human acting. */
  automatedWhatsAppFirstTouch: boolean;
  /** Automated (non-conversational) email is permitted. */
  automatedEmail: boolean;
  /** Default retention before the privacy purge sweeps the lead. */
  defaultRetentionDays: number;
};

/* WHAT EACH CLASS MEANS, precisely:
 *
 * first-party-form  -- the buyer filled THIS business's surface (Architech
 *   enquiry, the business's own website form) and saw the consent text.
 *   Evidence is our own form submission record. Full permissions.
 * ad-opt-in         -- the buyer submitted a Meta/Google lead form after
 *   clicking this business's ad. Consent text was the platform's, the
 *   intent is real, but it is shallower than first-party: automated sends
 *   additionally require the form to have carried an explicit WhatsApp
 *   opt-in checkbox (see `whatsappOptInEvidence`).
 * portal-shared     -- the buyer enquired on a portal, which shared/sold the
 *   enquiry to its listing brokers. Consent was given TO THE PORTAL and its
 *   resale chain is under active DPDP scrutiny. Human first touch only.
 * aggregator-shared -- same shape as portal-shared, B2B flavour
 *   (IndiaMart/JustDial/TradeIndia).
 * walk-in-verbal / referral-verbal -- offline, verbal consent only. Human
 *   first touch; record the employee as evidence.
 * imported-unknown  -- CSV/email backlog with NO provable consent. Contact
 *   is allowed (the broker bought/collected these leads) but automation is
 *   not, and retention is the shortest of any class.
 */
export const CONSENT_CLASSES: Record<ConsentClassId, ConsentPermissions & { definition: string }> = {
  "first-party-form": {
    definition: "Consent captured by this business on its own surface.",
    humanFirstTouch: true,
    automatedWhatsAppFirstTouch: true,
    automatedEmail: true,
    defaultRetentionDays: 180,
  },
  "ad-opt-in": {
    definition: "Buyer submitted a Meta/Google lead form for this business's ad.",
    humanFirstTouch: true,
    automatedWhatsAppFirstTouch: true,
    automatedEmail: true,
    defaultRetentionDays: 180,
  },
  "portal-shared": {
    definition: "Portal enquiry shared with its listing brokers; consent was given to the portal.",
    humanFirstTouch: true,
    automatedWhatsAppFirstTouch: false,
    automatedEmail: false,
    defaultRetentionDays: 90,
  },
  "aggregator-shared": {
    definition: "B2B aggregator lead; consent was given to the aggregator.",
    humanFirstTouch: true,
    automatedWhatsAppFirstTouch: false,
    automatedEmail: false,
    defaultRetentionDays: 90,
  },
  "walk-in-verbal": {
    definition: "In-person verbal consent at the business premises.",
    humanFirstTouch: true,
    automatedWhatsAppFirstTouch: false,
    automatedEmail: false,
    defaultRetentionDays: 90,
  },
  "referral-verbal": {
    definition: "Introduced by a referrer; no direct consent captured yet.",
    humanFirstTouch: true,
    automatedWhatsAppFirstTouch: false,
    automatedEmail: false,
    defaultRetentionDays: 90,
  },
  "imported-unknown": {
    definition: "Bulk import with no provable consent provenance.",
    humanFirstTouch: true,
    automatedWhatsAppFirstTouch: false,
    automatedEmail: false,
    defaultRetentionDays: 30,
  },
};

/** Resolve the permission matrix for a consent class. */
export function consentPermissionsFor(consentClass: ConsentClassId): ConsentPermissions {
  const entry = CONSENT_CLASSES[consentClass];
  return {
    humanFirstTouch: entry.humanFirstTouch,
    automatedWhatsAppFirstTouch: entry.automatedWhatsAppFirstTouch,
    automatedEmail: entry.automatedEmail,
    defaultRetentionDays: entry.defaultRetentionDays,
  };
}

/* ------------------------------------------------------------------ *
 * 3. The normalized lead schema
 * ------------------------------------------------------------------ */

export type LeadIntent = "buy" | "rent" | "sell" | "rent-out";

export type LeadPropertyType = "apartment" | "rowhouse" | "villa" | "penthouse" | "plot";

export type LeadConsentInput = {
  consentClass: ConsentClassId;
  /** Purpose identifier, e.g. "real-estate-enquiry". */
  purpose?: string;
  /** ISO timestamp of when/where consent was captured (the source's timestamp). */
  capturedAt: string;
  /** Bounded reference to the evidence: webhook id, form submission id, email
      Message-ID, employee id for verbal classes. Never free text about a person. */
  evidence: string;
  /** ISO timestamp after which the consent is stale (optional). */
  expiresAt?: string;
  /** For ad-opt-in: reference proving the form carried a WhatsApp opt-in
      checkbox. Required by resolveConsentPermissions to unlock automated
      WhatsApp for that class; other classes ignore it. */
  whatsappOptInEvidence?: string;
};

export type IngestedLeadInput = {
  source: LeadSourceId;
  /** Optional bounded qualifier: campaign name, listing package, sync source. */
  subsource?: string;
  /** The provider's own lead identifier, when it supplies one. */
  providerLeadId?: string;
  /** When the enquiry happened at the source (ISO). */
  occurredAt: string;
  name: { first?: string; last?: string; full?: string };
  /** Raw phone; normalised to E.164 here. */
  mobile: string;
  email?: string;
  city?: string;
  locality?: string;
  budgetMinInr?: number;
  budgetMaxInr?: number;
  bhk?: number;
  intent?: LeadIntent;
  propertyType?: LeadPropertyType;
  projectName?: string;
  projectId?: string;
  /** Verbatim requirement text from the source. Parsing is additive and
      lossless elsewhere (the parse-query grammar approach); the verbatim
      always survives as the note of record. */
  remarks?: string;
  consent: LeadConsentInput;
};

export type NormalizedLead = {
  contractVersion: number;
  source: { id: LeadSourceId; label: string; medium: LeadMedium; channelClass: LeadChannelClass; subsource?: string };
  providerLeadId?: string;
  /** Canonical dedupe key: the E.164 mobile. Same human, one lead. */
  dedupeKey: string;
  name: { first?: string; last?: string; full?: string };
  mobileE164: string;
  email?: string;
  city?: string;
  locality?: string;
  budgetMinInr?: number;
  budgetMaxInr?: number;
  bhk?: number;
  intent?: LeadIntent;
  propertyType?: LeadPropertyType;
  projectName?: string;
  projectId?: string;
  remarks?: string;
  occurredAt: string;
  consent: {
    consentClass: ConsentClassId;
    purpose: string;
    capturedAt: string;
    evidence: string;
    expiresAt?: string;
    permissions: ConsentPermissions;
  };
};

export type LeadValidationResult = { ok: true; lead: NormalizedLead } | { ok: false; errors: string[] };

/* ₹10 lakh crore. Beyond any real Indian property budget; above this the
   value is corruption, not a lead. Also below Number.MAX_SAFE_INTEGER. */
const BUDGET_MAX_INR = 10_000_000_000_000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function boundedString(value: string | undefined, field: string, errors: string[], required = false): string | undefined {
  if (value === undefined || value === null || String(value).trim() === "") {
    if (required) errors.push(`${field} is required.`);
    return undefined;
  }
  const trimmed = String(value).trim();
  if (trimmed.length > FRAPPE_DATA_MAX) {
    errors.push(`${field} exceeds ${FRAPPE_DATA_MAX} characters (${trimmed.length}).`);
    return undefined;
  }
  return trimmed;
}

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

/** Validate and normalize an ingested lead. Collects ALL errors; never guesses. */
export function validateIngestedLead(input: IngestedLeadInput): LeadValidationResult {
  const errors: string[] = [];

  /* Source must be a registered id -- an unknown source is a contract break,
     not a free-text opportunity. */
  const sourceDefinition = LEAD_SOURCES[input.source as LeadSourceId];
  if (!sourceDefinition) {
    errors.push(`Unknown lead source "${String(input.source)}". Register it in LEAD_SOURCES first.`);
  }

  const subsource = boundedString(input.subsource, "subsource", errors);

  /* Name: a full name or at least a first name. Portals send both shapes. */
  const first = boundedString(input.name?.first, "name.first", errors);
  const last = boundedString(input.name?.last, "name.last", errors);
  const full = boundedString(input.name?.full, "name.full", errors);
  if (!first && !full) errors.push("A lead needs at least a first or full name.");

  /* Mobile: the canonical key. Everything routes through the same E.164
     normaliser ERPNext/CRM matching depends on (see phone.ts). */
  const phone = normalizeIndianPhone(input.mobile);
  if (!phone.ok) errors.push(`mobile: ${phone.reason}`);

  const emailRaw = boundedString(input.email, "email", errors);
  const email = emailRaw ? emailRaw.toLowerCase() : undefined;
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.push("email is not a valid address.");
  }

  const city = boundedString(input.city, "city", errors);
  const locality = boundedString(input.locality, "locality", errors);

  if (input.budgetMinInr !== undefined && (!Number.isSafeInteger(input.budgetMinInr) || input.budgetMinInr <= 0 || input.budgetMinInr > BUDGET_MAX_INR)) {
    errors.push("budgetMinInr must be a positive integer within bounds.");
  }
  if (input.budgetMaxInr !== undefined && (!Number.isSafeInteger(input.budgetMaxInr) || input.budgetMaxInr <= 0 || input.budgetMaxInr > BUDGET_MAX_INR)) {
    errors.push("budgetMaxInr must be a positive integer within bounds.");
  }
  if (
    input.budgetMinInr !== undefined &&
    input.budgetMaxInr !== undefined &&
    input.budgetMinInr > input.budgetMaxInr
  ) {
    errors.push("budgetMinInr must not exceed budgetMaxInr.");
  }

  if (input.bhk !== undefined && (!Number.isInteger(input.bhk) || input.bhk < 1 || input.bhk > 10)) {
    errors.push("bhk must be an integer between 1 and 10.");
  }

  const projectName = boundedString(input.projectName, "projectName", errors);
  const projectId = boundedString(input.projectId, "projectId", errors);
  const remarks = boundedString(input.remarks, "remarks", errors);

  if (!isIsoTimestamp(input.occurredAt)) errors.push("occurredAt must be an ISO timestamp.");

  /* Consent: class must exist and evidence must be present. An adapter that
     cannot state consent provenance must not be able to emit a lead at all. */
  const consentClass = input.consent?.consentClass as ConsentClassId;
  if (!consentClass || !(consentClass in CONSENT_CLASSES)) {
    errors.push(`Unknown consent class "${String(consentClass)}".`);
  }
  const purpose = boundedString(input.consent?.purpose, "consent.purpose", errors) ?? "real-estate-enquiry";
  const evidence = boundedString(input.consent?.evidence, "consent.evidence", errors, true);
  const whatsappOptInEvidence = boundedString(input.consent?.whatsappOptInEvidence, "consent.whatsappOptInEvidence", errors);
  if (input.consent?.capturedAt && !isIsoTimestamp(input.consent.capturedAt)) {
    errors.push("consent.capturedAt must be an ISO timestamp.");
  }
  if (!input.consent?.capturedAt) errors.push("consent.capturedAt is required.");
  if (input.consent?.expiresAt && !isIsoTimestamp(input.consent.expiresAt)) {
    errors.push("consent.expiresAt must be an ISO timestamp.");
  }
  /* The ad-opt-in class does NOT error without WhatsApp-checkbox evidence:
     the buyer opted in via the ad form, so the lead is contactable -- but the
     resolved permission matrix keeps automated WhatsApp locked until that
     evidence exists (handled below via effectivePermissions). Rejecting here
     would discard a perfectly contactable lead over a send-mode detail. */

  if (errors.length > 0 || !sourceDefinition || !phone.ok || !consentClass || !(consentClass in CONSENT_CLASSES)) {
    return { ok: false, errors };
  }

  const permissions = consentPermissionsFor(consentClass);
  const effectivePermissions: ConsentPermissions =
    consentClass === "ad-opt-in" && whatsappOptInEvidence === undefined
      ? { ...permissions, automatedWhatsAppFirstTouch: false }
      : permissions;

  return {
    ok: true,
    lead: {
      contractVersion: LEAD_INGESTION_CONTRACT_VERSION,
      source: { id: input.source, ...sourceDefinition, ...(subsource ? { subsource } : {}) },
      ...(input.providerLeadId ? { providerLeadId: input.providerLeadId } : {}),
      dedupeKey: phone.e164,
      name: { ...(first ? { first } : {}), ...(last ? { last } : {}), ...(full ? { full } : {}) },
      mobileE164: phone.e164,
      ...(email ? { email } : {}),
      ...(city ? { city } : {}),
      ...(locality ? { locality } : {}),
      ...(input.budgetMinInr !== undefined ? { budgetMinInr: input.budgetMinInr } : {}),
      ...(input.budgetMaxInr !== undefined ? { budgetMaxInr: input.budgetMaxInr } : {}),
      ...(input.bhk !== undefined ? { bhk: input.bhk } : {}),
      ...(input.intent ? { intent: input.intent } : {}),
      ...(input.propertyType ? { propertyType: input.propertyType } : {}),
      ...(projectName ? { projectName } : {}),
      ...(projectId ? { projectId } : {}),
      ...(remarks ? { remarks } : {}),
      occurredAt: input.occurredAt,
      consent: {
        consentClass,
        purpose,
        capturedAt: input.consent.capturedAt,
        evidence: evidence!,
        ...(input.consent.expiresAt ? { expiresAt: input.consent.expiresAt } : {}),
        permissions: effectivePermissions,
      },
    },
  };
}

/* ------------------------------------------------------------------ *
 * 4. Ingestion idempotency
 * ------------------------------------------------------------------ */

/* Re-delivery is normal: portals retry webhooks, pull workers re-fetch an
   overlapping window, email parsing re-reads a mailbox. The
   (source, providerLeadId) pair identifies the source's own lead; the key is
   bounded to 128 chars by the same rule as every outbound projection key. */
export function ingestIdempotencyKey(source: LeadSourceId, providerLeadId: string): string {
  return buildIdempotencyKey({ event: `lead.ingest.${source}`, version: LEAD_INGESTION_CONTRACT_VERSION, parts: [providerLeadId] });
}
