import { getListingById } from "@/lib/repositories";

export type LeadMode = "MASKED" | "DIRECT_CONSENTED";
export type LeadStatus = "NEW" | "ACKNOWLEDGED" | "REPLIED" | "CLOSED" | "DELETED";

export type LeadStatusEvent = {
  id: string;
  action: string;
  at: string;
  metadata?: Record<string, unknown>;
};

export type LeadInput = {
  listingId: string;
  name: string;
  phone: string;
  email?: string;
  message: string;
  mode?: LeadMode;
  consentText: string;
  idempotencyKey?: string;
};

export type LeadRecord = {
  id: string;
  listingId: string;
  listingTitle: string;
  organizationName: "Nivasa Partners";
  name: string;
  phoneMasked: string;
  email?: string;
  message: string;
  mode: LeadMode;
  status: LeadStatus;
  consentText: string;
  idempotencyKey: string;
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

export type LeadResult =
  | { ok: true; lead: LeadRecord; duplicate: boolean }
  | { ok: false; status: number; errors: string[] };

const leadsByKey = new Map<string, LeadRecord>();

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

export function validateLeadInput(input: Partial<LeadInput>): string[] {
  const errors: string[] = [];
  if (!input.listingId || !getListingById(input.listingId)) errors.push("Choose a valid listing.");
  if (!input.name || input.name.trim().length < 2) errors.push("Name must be at least 2 characters.");
  if (!input.phone || input.phone.replace(/\D/g, "").length < 8) errors.push("Phone must include at least 8 digits.");
  if (!input.message || input.message.trim().length < 10) errors.push("Message must be at least 10 characters.");
  if (!input.consentText || input.consentText.trim().length < 12) errors.push("Consent text is required.");
  if (input.email && !/^\S+@\S+\.\S+$/.test(input.email)) errors.push("Email must be valid when provided.");
  if (input.mode && input.mode !== "MASKED" && input.mode !== "DIRECT_CONSENTED") errors.push("Lead mode is invalid.");
  return errors;
}

export function createLead(input: LeadInput): LeadResult {
  const errors = validateLeadInput(input);
  if (errors.length) return { ok: false, status: 400, errors };

  const listing = getListingById(input.listingId)!;
  const key = input.idempotencyKey?.trim() || `${input.listingId}:${input.phone.replace(/\D/g, "")}:${input.message.trim().toLowerCase()}`;
  const existing = leadsByKey.get(key);
  if (existing) return { ok: true, lead: existing, duplicate: true };

  const now = new Date().toISOString();
  const lead: LeadRecord = {
    id: stableId("lead", key),
    listingId: input.listingId,
    listingTitle: listing.title,
    organizationName: "Nivasa Partners",
    name: input.name.trim(),
    phoneMasked: maskPhone(input.phone),
    email: input.email?.trim() || undefined,
    message: input.message.trim(),
    mode: input.mode ?? "MASKED",
    status: "NEW",
    consentText: input.consentText.trim(),
    idempotencyKey: key,
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
export function listActiveLeads(): LeadRecord[] {
  return listLeads().filter((record) => record.status !== "DELETED");
}

export function resetLeadStoreForTests() {
  leadsByKey.clear();
}
