import { getListingById } from "@/lib/repositories";
import { buildLeadIdempotencyKey, validateCallerIdempotencyKey } from "@/lib/interop/idempotency";
import { OUTCOME_RULES, type CallOutcome, type OutcomeRule } from "./calling";

export type LeadMode = "MASKED" | "DIRECT_CONSENTED";
export type LeadStatus = "NEW" | "ACKNOWLEDGED" | "REPLIED" | "CLOSED" | "DELETED";
export const LEAD_CONSENT_CLASSES = ["first-party-form", "portal-shared", "aggregator-shared"] as const;
export type LeadConsentClass = (typeof LEAD_CONSENT_CLASSES)[number];

export type LeadStatusEvent = {
  id: string;
  action: string;
  at: string;
  metadata?: Record<string, unknown>;
};

export type LeadInput = {
  listingId: string;
  /* The organization that owns the listing being enquired about, resolved
     SERVER-SIDE from the listing. Never taken from the request body: a lead
     is routed to an inbox by this value, so a caller who could set it could
     inject leads into a competitor's inbox -- or read their own out of it. */
  organizationId?: string | null;
  name: string;
  phone: string;
  email?: string;
  message: string;
  mode?: LeadMode;
  consentText: string;
  consentClass?: LeadConsentClass;
  idempotencyKey?: string;
  /** Explicit opt-in for one acknowledgement only; absent means false. */
  whatsappOptIn?: boolean;
  /** Accepted for input-shape compatibility but never trusted for capture time. */
  whatsappOptInAt?: string;
  whatsappOptInText?: string;
};

export type LeadRecord = {
  id: string;
  listingId: string;
  listingTitle: string;
  /** Owning organization's id. This is what scopes the lead inbox. */
  organizationId: string | null;
  /** Resolved from the listing's own organization/broker — never a literal. */
  organizationName: string;
  name: string;
  phoneMasked: string;
  email?: string;
  message: string;
  mode: LeadMode;
  status: LeadStatus;
  consentText: string;
  consentClass?: string;
  idempotencyKey: string;
  whatsappOptIn: boolean;
  whatsappOptInAt?: string;
  whatsappOptInText?: string;
  auditEvent: {
    id: string;
    action: "lead.created";
    entityType: "Lead";
    metadata: {
      masked: boolean;
      source: "api.leads.fixture-store" | "api.leads.prisma";
    };
  };
  /** Append-only events for the masked-response (reply/close) workflow. */
  statusHistory: LeadStatusEvent[];
  createdAt: string;
};

export type LeadDetailRecord = LeadRecord & {
  stage: string;
  callAttempts: number;
  maxAttempts: number;
  suppressed: boolean;
  nextActionAt: string | null;
  callHistory: Array<{ outcome: string; stageBefore: string; stageAfter: string; nextActionAt: string | null; note: string | null; createdAt: string }>;
};

export type LeadResult =
  | { ok: true; lead: LeadRecord; duplicate: boolean }
  | { ok: false; status: number; errors: string[] };

/* bounded-state: FIXTURE-MODE DEMO STORE. Selected by getPersistenceMode()
   (persistence/source.ts) only when ARCHITECH_DATA_SOURCE !== "prisma";
   production serves these routes from persistence/*-store.ts over PostgreSQL,
   so entry count tracks the seed fixture, not live traffic. Gating enforced by
   `pnpm production:plan:audit`. Cleared in the round-4 hunt: by design. */
const leadsByKey = new Map<string, LeadRecord>();
const contactByLeadId = new Map<string, string>();

/* Fixture-mode call state (spec §5 "both-store parity"): mirrors the prisma
   LeadCallLog + Lead stage/callAttempts/callSuppressedAt updates so the full
   detail → reveal → dial → log → stage-change flow works in memory mode
   (local dev + e2e) with no database. */
export type FixtureCallEntry = {
  outcome: string;
  stageBefore: string;
  stageAfter: string;
  nextActionAt: string | null;
  note: string | null;
  lostReason: string | null;
  /** When the outcome was logged (ISO). Stamped by recordFixtureCall. */
  at: string;
};
const callsByLeadId = new Map<string, FixtureCallEntry[]>();

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••• ••• ${digits.slice(-4)}`;
}

function stableId(prefix: string, key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${prefix}_${hash.toString(36)}`;
}

function containsControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

export function validateWhatsAppOptIn(input: Partial<LeadInput>): string[] {
  if (input.whatsappOptIn !== true) return [];
  const copy = typeof input.whatsappOptInText === "string" ? input.whatsappOptInText.trim() : "";
  const errors: string[] = [];
  if (copy.length < 12 || copy.length > 240) errors.push("WhatsApp opt-in text must be between 12 and 240 characters.");
  if (containsControlCharacters(copy)) errors.push("WhatsApp opt-in text contains invalid control characters.");
  return errors;
}

export function validateLeadInput(input: Partial<LeadInput>): string[] {
  const errors: string[] = [];
  if (!input.listingId || !getListingById(input.listingId)) errors.push("Choose a valid listing.");
  if (!input.name || input.name.trim().length < 2) errors.push("Name must be at least 2 characters.");
  if (!input.phone || input.phone.replace(/\D/g, "").length < 8) errors.push("Phone must include at least 8 digits.");
  if (!input.message || input.message.trim().length < 10) errors.push("Message must be at least 10 characters.");
  if (!input.consentText || input.consentText.trim().length < 12) errors.push("Consent text is required.");
  if (input.email && !/^\S+@\S+\.\S+$/.test(input.email)) errors.push("Email must be valid when provided.");
  if (input.mode && input.mode !== "MASKED" && input.mode !== "DIRECT_CONSENTED") errors.push("Lead mode is invalid.");
  if (input.consentClass && !LEAD_CONSENT_CLASSES.includes(input.consentClass as LeadConsentClass)) errors.push("Consent class is invalid.");
  errors.push(...validateWhatsAppOptIn(input));
  return errors;
}

export function createLead(input: LeadInput): LeadResult {
  const errors = validateLeadInput(input);
  if (errors.length) return { ok: false, status: 400, errors };

  const listing = getListingById(input.listingId)!;
  let key: string;
  try {
    key = input.idempotencyKey?.trim()
      ? validateCallerIdempotencyKey(input.idempotencyKey)
      : buildLeadIdempotencyKey({
          listingId: input.listingId,
          normalizedPhone: input.phone.replace(/\D/g, ""),
          normalizedMessage: input.message,
        });
  } catch (error) {
    return { ok: false, status: 400, errors: [error instanceof Error ? error.message : "Invalid idempotency key."] };
  }
  const existing = leadsByKey.get(key);
  if (existing) return { ok: true, lead: existing, duplicate: true };

  const now = new Date().toISOString();
  const whatsappOptIn = input.whatsappOptIn === true;
  const whatsappOptInText = whatsappOptIn ? input.whatsappOptInText!.trim() : undefined;
  const lead: LeadRecord = {
    id: stableId("lead", key),
    listingId: input.listingId,
    listingTitle: listing.title,
    organizationId: input.organizationId ?? null,
    organizationName: listing.developer,
    name: input.name.trim(),
    phoneMasked: maskPhone(input.phone),
    email: input.email?.trim() || undefined,
    message: input.message.trim(),
    mode: input.mode ?? "MASKED",
    status: "NEW",
    consentText: input.consentText.trim(),
    /* Both-store parity (spec §5): the prisma write path already defaults
       consentClass to first-party-form; the fixture store must match. */
    consentClass: input.consentClass ?? "first-party-form",
    idempotencyKey: key,
    whatsappOptIn,
    ...(whatsappOptInText ? { whatsappOptInText, whatsappOptInAt: now } : {}),
    auditEvent: {
      id: stableId("audit", `${key}:lead.created`),
      action: "lead.created",
      entityType: "Lead",
      metadata: { masked: (input.mode ?? "MASKED") === "MASKED", source: "api.leads.fixture-store" },
    },
    statusHistory: [
      { id: stableId("audit", `${key}:lead.created`), action: "lead.created", at: now, metadata: { masked: (input.mode ?? "MASKED") === "MASKED", source: "api.leads.fixture-store" } },
    ],
    createdAt: now,
  };

  leadsByKey.set(key, lead);
  contactByLeadId.set(lead.id, input.phone);
  return { ok: true, lead, duplicate: false };
}

/** All leads for a broker, newest-first. Memory-store read for the fixture path. */
export function listLeads(): LeadRecord[] {
  return [...leadsByKey.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Advance a lead's status (masked-response workflow) and append to its trail. */
export function updateLeadStatus(
  id: string,
  status: Exclude<LeadStatus, "NEW" | "DELETED">
): { ok: true; lead: LeadRecord } | { ok: false; status: number; errors: string[] } {
  const lead = [...leadsByKey.values()].find((record) => record.id === id);
  if (!lead) return { ok: false, status: 404, errors: ["Lead not found."] };
  lead.status = status;
  lead.statusHistory.push({ id: stableId("audit", `lead.${status.toLowerCase()}:${id}`), action: `lead.${status.toLowerCase()}`, at: new Date().toISOString(), metadata: { source: "api.broker.leads.reply.fixture-store" } });
  return { ok: true, lead };
}

/** Soft-delete a lead (retention-privacy) and record the revocation in its trail. */
export function softDeleteLead(id: string): { ok: true; lead: LeadRecord } | { ok: false; status: number; errors: string[] } {
  const lead = [...leadsByKey.values()].find((record) => record.id === id);
  if (!lead) return { ok: false, status: 404, errors: ["Lead not found."] };
  lead.status = "DELETED";
  lead.statusHistory.push({ id: stableId("audit", `lead.deleted:${id}`), action: "lead.deleted", at: new Date().toISOString(), metadata: { source: "api.broker.leads.delete.fixture-store" } });
  return { ok: true, lead };
}

/** Revoke a lead's stored data at the buyer's request (privacy/consent). */
export function revokeLeadConsent(id: string): { ok: true; lead: LeadRecord } | { ok: false; status: number; errors: string[] } {
  const lead = [...leadsByKey.values()].find((record) => record.id === id);
  if (!lead) return { ok: false, status: 404, errors: ["Lead not found."] };
  lead.status = "DELETED";
  lead.statusHistory.push({ id: stableId("audit", `lead.consent.revoked:${id}`), action: "lead.consent.revoked", at: new Date().toISOString(), metadata: { source: "api.broker.leads.consent.fixture-store" } });
  return { ok: true, lead };
}

/** Leads visible to a broker: excludes soft-deleted records. */
/* The leads belonging to ONE organization.
 *
 * `organizationId` is required rather than optional: this function used to
 * take no argument at all, so every broker organization saw every other
 * organization's enquiries -- buyer names, masked phones, messages and the
 * listing each referred to. Making the parameter mandatory means an
 * unscoped call is a compile error rather than a silent leak. */
export function listActiveLeads(organizationId: string): LeadRecord[] {
  if (!organizationId) return [];
  return listLeads().filter((record) => record.status !== "DELETED" && record.organizationId === organizationId);
}

/** A single lead, only if it belongs to the given organization. Returns null
    for a foreign lead so callers cannot distinguish it from a missing one. */
export function findLeadForOrganization(id: string, organizationId: string): LeadRecord | null {
  if (!organizationId) return null;
  const lead = listLeads().find((record) => record.id === id);
  return lead && lead.organizationId === organizationId ? lead : null;
}

export function getFixtureLeadContact(id: string): string | null {
  return contactByLeadId.get(id) ?? null;
}

/** Fixture-mode call logging: mirrors the prisma LeadCallLog update path so
    the detail → dial → log flow works without a database (e2e + demo). */
export function recordFixtureCall(
  leadId: string,
  entry: { outcome: string; stageBefore: string; stageAfter: string; nextActionAt: string | null; note: string | null; lostReason: string | null },
): void {
  const calls = callsByLeadId.get(leadId) ?? [];
  calls.push({ ...entry, at: new Date().toISOString() });
  callsByLeadId.set(leadId, calls);
}

/** Fixture-mode metrics for the call-result panel (overdue / outcomes / lost
    reasons). Mirrors getLeadMetricsForServer's prisma branch, computed over
    the in-memory call store. The store is bounded by design, so no row cap. */
export function fixtureCallMetrics(organizationId: string): { overdue: number; outcomes: Record<string, number>; lostReasons: Record<string, number> } {
  const outcomes: Record<string, number> = {};
  const lostReasons: Record<string, number> = {};
  let overdue = 0;
  const now = Date.now();
  for (const lead of listLeads()) {
    if (lead.organizationId !== organizationId || lead.status === "DELETED") continue;
    for (const call of callsByLeadId.get(lead.id) ?? []) {
      outcomes[call.outcome] = (outcomes[call.outcome] ?? 0) + 1;
      if (call.nextActionAt && new Date(call.nextActionAt).getTime() <= now) overdue += 1;
      if (call.lostReason) lostReasons[call.lostReason] = (lostReasons[call.lostReason] ?? 0) + 1;
    }
  }
  return { overdue, outcomes, lostReasons };
}

/** Read-side of the fixture call state for the single-lead detail contract.
    Suppression is derived from OUTCOME_RULES (the single source of truth for
    which outcomes put a number on the do-not-call list), never re-listed. */
export function fixtureLeadDetail(
  id: string,
  organizationId: string,
): { stage: string; callAttempts: number; suppressed: boolean; nextActionAt: string | null; callHistory: FixtureCallEntry[] } | null {
  const lead = findLeadForOrganization(id, organizationId);
  if (!lead) return null;
  const calls = callsByLeadId.get(id) ?? [];
  const last = calls.at(-1);
  return {
    stage: last?.stageAfter ?? "NEW",
    callAttempts: calls.length,
    suppressed: calls.some((call) => (OUTCOME_RULES as Record<string, OutcomeRule | undefined>)[call.outcome as CallOutcome]?.suppressesContact === true),
    nextActionAt: last?.nextActionAt ?? null,
    callHistory: calls.map((call) => ({ ...call })),
  };
}

export function resetLeadStoreForTests() {
  leadsByKey.clear();
  contactByLeadId.clear();
  callsByLeadId.clear();
}
