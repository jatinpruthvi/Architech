import "server-only";
import { createLead, findLeadForOrganization, listActiveLeads, maskPhone, revokeLeadConsent, softDeleteLead, updateLeadStatus, validateLeadInput, type LeadInput, type LeadMode, type LeadRecord, type LeadResult, type LeadStatus } from "./lead";
import { emitLeadEvent } from "./events";
import { isPrismaLeadStorage } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { demoBrokerSession } from "@/lib/auth/roles";

type PrismaLeadClient = ReturnType<typeof getPrismaClient> & {
  listing: { findFirst(args: unknown): Promise<{ id: string; title: string; brokerOrgId?: string | null; brokerOrg?: { name: string } | null } | null> };
  lead: {
    findUnique(args: unknown): Promise<unknown | null>;
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
    create(args: unknown): Promise<{ id: string; createdAt: Date }>;
    update(args: unknown): Promise<{ id: string }>;
  };
  auditEvent: { create(args: unknown): Promise<{ id: string }> };
  $transaction<T>(fn: (tx: PrismaLeadClient) => Promise<T>): Promise<T>;
};

/** A datetime that refuses to be a RangeError. A null/missing `createdAt`
    becomes the current time — synthesizing a broken Date was the bug. */
function safeIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/** Prisma P2002 = unique constraint violation, i.e. the concurrent duplicate
    that the pre-check raced against. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

function baseErrors(input: Partial<LeadInput>) {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length < 2) errors.push("Name must be at least 2 characters.");
  if (!input.phone || input.phone.replace(/\D/g, "").length < 8) errors.push("Phone must include at least 8 digits.");
  if (!input.message || input.message.trim().length < 10) errors.push("Message must be at least 10 characters.");
  if (!input.consentText || input.consentText.trim().length < 12) errors.push("Consent text is required.");
  if (input.email && !/^\S+@\S+\.\S+$/.test(input.email)) errors.push("Email must be valid when provided.");
  if (input.mode && input.mode !== "MASKED" && input.mode !== "DIRECT_CONSENTED") errors.push("Lead mode is invalid.");
  return errors;
}

function stableId(prefix: string, key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${prefix}_${hash.toString(36)}`;
}

export async function createLeadForServer(input: LeadInput): Promise<LeadResult> {
  /* Fixture listings carry no broker organization, so a fixture lead is
     attributed to the demo organization -- the same inbox the demo broker
     session reads. Crucially the value is still derived here and never taken
     from the request body. */
  if (!isPrismaLeadStorage()) {
    const created = createLead({ ...input, organizationId: demoBrokerSession.organization?.id ?? null });
    if (created.ok && !created.duplicate) {
      emitLeadEvent({ type: "lead.created", leadId: created.lead.id, organizationId: created.lead.organizationId, listingId: input.listingId, listingTitle: created.lead.listingTitle, createdAt: created.lead.createdAt });
    }
    return created;
  }

  const errors = baseErrors(input);
  if (errors.length) return { ok: false, status: 400, errors };

  const prisma = getPrismaClient() as unknown as PrismaLeadClient;
  const listing = await prisma.listing.findFirst({
    where: { OR: [{ stableId: input.listingId }, { slug: input.listingId }], lifecycle: "ACTIVE" },
    include: { brokerOrg: { select: { name: true } } },
  }) as { id: string; title: string; brokerOrgId?: string | null; brokerOrg?: { name: string } | null } | null;
  if (!listing) return { ok: false, status: 400, errors: ["Choose a valid listing."] };

  const key = input.idempotencyKey?.trim() || `${input.listingId}:${input.phone.replace(/\D/g, "")}:${input.message.trim().toLowerCase()}`;
  const organizationName = listing.brokerOrg?.name ?? "Verified partner";
  /* The owning organization is read off the LISTING. Anything the caller sent
     in `organizationId` is discarded -- that field decides which inbox the
     lead lands in. */
  const owning = { ...input, organizationId: listing.brokerOrgId ?? null };
  const existing = await prisma.lead.findUnique({ where: { idempotencyKey: key } });
  if (existing && typeof existing === "object") {
    // Avoid exposing raw DB rows; return deterministic contract shape.
    const lead = dbLeadContract(owning, listing.title, stableId("lead", key), stableId("audit", `${key}:lead.created`), true, new Date().toISOString(), "api.leads.prisma", organizationName);
    return { ok: true, lead, duplicate: true };
  }

  let result: { dbLead: { id: string; createdAt: Date }; audit: { id: string } };
  try {
    result = await prisma.$transaction(async (tx) => {
      const dbLead = await tx.lead.create({
        data: {
          listingId: listing.id,
          organizationId: listing.brokerOrgId,
          mode: input.mode ?? "MASKED",
          status: "NEW",
          name: input.name.trim(),
          phoneMasked: maskPhone(input.phone),
          email: input.email?.trim() || undefined,
          message: input.message.trim(),
          consentText: input.consentText.trim(),
          idempotencyKey: key,
        },
      });
      const audit = await tx.auditEvent.create({
        data: {
          leadId: dbLead.id,
          listingId: listing.id,
          organizationId: listing.brokerOrgId,
          action: "lead.created",
          entityType: "Lead",
          entityId: dbLead.id,
          metadata: { masked: (input.mode ?? "MASKED") === "MASKED", source: "api.leads.prisma" },
        },
      });
      return { dbLead, audit };
    });
  } catch (error) {
    /* B-5: two concurrent identical posts (double-click, retry, two tabs) can
       both pass the findUnique above; the second must not become a 500. The
       unique constraint is the arbiter — return the winner as a duplicate. */
    if (isUniqueViolation(error)) {
      const winner = (await prisma.lead.findUnique({ where: { idempotencyKey: key } })) as { id: string } | null;
      const row = winner ? await refetchLeadOrNotFound(prisma, winner.id) : null;
      const lead = row
        ? dbLeadRowToContract(row)
        : dbLeadContract(owning, listing.title, stableId("lead", key), stableId("audit", `${key}:lead.created`), true, new Date().toISOString(), "api.leads.prisma", organizationName);
      return { ok: true, lead, duplicate: true };
    }
    throw error;
  }

  const lead = dbLeadContract(owning, listing.title, result.dbLead.id, result.audit.id, false, result.dbLead.createdAt.toISOString(), "api.leads.prisma", organizationName);
  /* Emit only on a genuinely new durable lead — the duplicate paths above
     re-return the winner and must not re-notify. */
  emitLeadEvent({ type: "lead.created", leadId: lead.id, organizationId: listing.brokerOrgId ?? null, listingId: input.listingId, listingTitle: listing.title, createdAt: lead.createdAt });
  return { ok: true, lead, duplicate: false };
}

function dbLeadContract(input: LeadInput, listingTitle: string, id: string, auditId: string, duplicate: boolean, createdAt = new Date().toISOString(), source: "api.leads.fixture-store" | "api.leads.prisma" = "api.leads.prisma", organizationName = "Verified partner"): LeadRecord {
  return {
    id,
    listingId: input.listingId,
    listingTitle,
    organizationId: input.organizationId ?? null,
    organizationName,
    name: input.name.trim(),
    phoneMasked: maskPhone(input.phone),
    email: input.email?.trim() || undefined,
    message: input.message.trim(),
    mode: input.mode ?? "MASKED",
    status: "NEW",
    consentText: input.consentText.trim(),
    idempotencyKey: input.idempotencyKey?.trim() || `${input.listingId}:${input.phone.replace(/\D/g, "")}:${input.message.trim().toLowerCase()}`,
    auditEvent: { id: auditId, action: "lead.created", entityType: "Lead", metadata: { masked: (input.mode ?? "MASKED") === "MASKED", source } },
    statusHistory: [{ id: auditId, action: "lead.created", at: createdAt, metadata: { masked: (input.mode ?? "MASKED") === "MASKED", source } }],
    createdAt,
  };
}

/** Map a Prisma lead row (with listing title) to the lead contract. */
function dbLeadRowToContract(row: Record<string, unknown>, organizationName = "Verified partner"): LeadRecord {
  const id = String(row.id ?? "");
  const listing = (row.listing ?? {}) as { title?: string; brokerOrg?: { name?: string } | null };
  const createdAt = safeIso(row.createdAt);
  return {
    id,
    listingId: String(row.listingId ?? ""),
    listingTitle: listing.title ?? "Unknown listing",
    organizationId: typeof row.organizationId === "string" ? row.organizationId : null,
    organizationName: listing.brokerOrg?.name ?? organizationName,
    name: String(row.name ?? ""),
    phoneMasked: String(row.phoneMasked ?? ""),
    email: typeof row.email === "string" ? row.email : undefined,
    message: String(row.message ?? ""),
    mode: String(row.mode ?? "MASKED") as LeadMode,
    status: String(row.status ?? "NEW") as LeadStatus,
    consentText: String(row.consentText ?? ""),
    idempotencyKey: String(row.idempotencyKey ?? ""),
    auditEvent: { id: stableId("audit", `${id}:lead.created`), action: "lead.created", entityType: "Lead", metadata: { masked: true, source: "api.leads.prisma" } },
    statusHistory: [],
    createdAt,
  };
}

const LEAD_LISTING_INCLUDE = { listing: { select: { title: true, brokerOrg: { select: { name: true } } } } } as const;

function refetchLeadOrNotFound(prisma: PrismaLeadClient, id: string): Promise<Record<string, unknown> | null> {
  return prisma.lead.findUnique({ where: { id }, include: LEAD_LISTING_INCLUDE }) as Promise<Record<string, unknown> | null>;
}

/** All leads for the broker inbox, newest-first. */
/* One organization's lead inbox.
 *
 * `organizationId` is mandatory. This function previously took no argument
 * and returned every non-deleted lead in the table, so each broker saw every
 * other broker's enquiries. The filter is in the QUERY so a foreign lead is
 * never loaded into memory. */
export async function listLeadsForServer(organizationId: string): Promise<LeadRecord[]> {
  if (!organizationId) return [];
  if (!isPrismaLeadStorage()) return listActiveLeads(organizationId);
  const prisma = getPrismaClient() as unknown as PrismaLeadClient;
  const rows = await prisma.lead.findMany({
    where: { deletedAt: null, organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: LEAD_LISTING_INCLUDE,
  });
  return rows.map((row) => dbLeadRowToContract(row));
}

/* Ownership check shared by every lead mutation.
 *
 * Returns 404 (not 403) for a lead owned by another organization: a 403 would
 * confirm the id exists, letting a caller enumerate a competitor's inbox by
 * probing ids. Absent and forbidden are made indistinguishable. */
export async function assertLeadBelongsToOrg(id: string, organizationId: string): Promise<{ ok: true } | { ok: false; status: number; errors: string[] }> {
  const notFound = { ok: false as const, status: 404, errors: ["Lead not found."] };
  if (!organizationId) return notFound;
  if (!isPrismaLeadStorage()) {
    return findLeadForOrganization(id, organizationId) ? { ok: true } : notFound;
  }
  const prisma = getPrismaClient() as unknown as PrismaLeadClient;
  const row = (await prisma.lead.findUnique({ where: { id } })) as { organizationId?: string | null } | null;
  if (!row || row.organizationId !== organizationId) return notFound;
  return { ok: true };
}

/** Soft-delete a lead (retention-privacy) and record the audit trail. */
export async function deleteLeadForServer(id: string): Promise<{ ok: true; lead: LeadRecord } | { ok: false; status: number; errors: string[] }> {
  if (!isPrismaLeadStorage()) return softDeleteLead(id);
  const prisma = getPrismaClient() as unknown as PrismaLeadClient;
  const existing = (await prisma.lead.findUnique({ where: { id } })) as { id: string; deletedAt?: Date | null } | null;
  if (!existing) return { ok: false, status: 404, errors: ["Lead not found."] };
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date(), status: "DELETED" } });
  /* B-6: a missing row after the update is a real not-found, not a licence to
     fabricate a lead with `new Date(undefined)` (a RangeError → 500). */
  const row = await refetchLeadOrNotFound(prisma, id);
  if (!row) return { ok: false, status: 404, errors: ["Lead not found."] };
  return { ok: true, lead: dbLeadRowToContract(row) };
}

/** Revoke a lead's stored data at the buyer's request (privacy/consent). */
export async function revokeLeadConsentForServer(id: string): Promise<{ ok: true; lead: LeadRecord } | { ok: false; status: number; errors: string[] }> {
  if (!isPrismaLeadStorage()) return revokeLeadConsent(id);
  const prisma = getPrismaClient() as unknown as PrismaLeadClient;
  const existing = (await prisma.lead.findUnique({ where: { id } })) as { id: string; deletedAt?: Date | null } | null;
  if (!existing) return { ok: false, status:404, errors: ["Lead not found."] };
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date(), status: "DELETED" } });
  await prisma.auditEvent.create({ data: { leadId: id, action: "lead.consent.revoked", entityType: "Lead", entityId: id, metadata: { source: "api.broker.leads.consent.prisma" } } });
  const row = await refetchLeadOrNotFound(prisma, id);
  if (!row) return { ok: false, status: 404, errors: ["Lead not found."] };
  return { ok: true, lead: dbLeadRowToContract(row) };
}

/** Advance a lead's status in the masked-response workflow (with audit). */
export async function updateLeadStatusForServer(
  id: string,
  status: Exclude<LeadStatus, "NEW" | "DELETED">
): Promise<{ ok: true; lead: LeadRecord } | { ok: false; status: number; errors: string[] }> {
  if (!isPrismaLeadStorage()) return updateLeadStatus(id, status);
  const prisma = getPrismaClient() as unknown as PrismaLeadClient;
  const existing = (await prisma.lead.findUnique({ where: { id } })) as { id: string; listingId: string; organizationId?: string | null } | null;
  if (!existing) return { ok: false, status: 404, errors: ["Lead not found."] };
  await prisma.lead.update({ where: { id }, data: { status } });
  await prisma.auditEvent.create({
    data: { leadId: id, listingId: existing.listingId, organizationId: existing.organizationId, action: `lead.${status.toLowerCase()}`, entityType: "Lead", entityId: id, metadata: { source: "api.broker.leads.reply.prisma" } },
  });
  const row = await refetchLeadOrNotFound(prisma, id);
  if (!row) return { ok: false, status: 404, errors: ["Lead not found."] };
  return { ok: true, lead: dbLeadRowToContract(row) };
}

export function validateLeadInputForConfiguredSource(input: Partial<LeadInput>) {
  return isPrismaLeadStorage() ? baseErrors(input) : validateLeadInput(input);
}
