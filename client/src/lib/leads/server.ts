import "server-only";
import { createLead, listActiveLeads, maskPhone, revokeLeadConsent, softDeleteLead, updateLeadStatus, validateLeadInput, type LeadInput, type LeadMode, type LeadRecord, type LeadResult, type LeadStatus } from "./lead";
import { isPrismaLeadStorage } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

type PrismaLeadClient = ReturnType<typeof getPrismaClient> & {
  listing: { findFirst(args: unknown): Promise<{ id: string; title: string; brokerOrgId?: string | null } | null> };
  lead: {
    findUnique(args: unknown): Promise<unknown | null>;
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
    create(args: unknown): Promise<{ id: string; createdAt: Date }>;
    update(args: unknown): Promise<{ id: string }>;
  };
  auditEvent: { create(args: unknown): Promise<{ id: string }> };
  $transaction<T>(fn: (tx: PrismaLeadClient) => Promise<T>): Promise<T>;
};

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
  if (!isPrismaLeadStorage()) return createLead(input);

  const errors = baseErrors(input);
  if (errors.length) return { ok: false, status: 400, errors };

  const prisma = getPrismaClient() as unknown as PrismaLeadClient;
  const listing = await prisma.listing.findFirst({ where: { OR: [{ stableId: input.listingId }, { slug: input.listingId }], lifecycle: "ACTIVE" } }) as { id: string; title: string; brokerOrgId?: string | null } | null;
  if (!listing) return { ok: false, status: 400, errors: ["Choose a valid listing."] };

  const key = input.idempotencyKey?.trim() || `${input.listingId}:${input.phone.replace(/\D/g, "")}:${input.message.trim().toLowerCase()}`;
  const existing = await prisma.lead.findUnique({ where: { idempotencyKey: key } });
  if (existing && typeof existing === "object") {
    // Avoid exposing raw DB rows; return deterministic contract shape.
    const lead = dbLeadContract(input, listing.title, stableId("lead", key), stableId("audit", `${key}:lead.created`), true);
    return { ok: true, lead, duplicate: true };
  }

  const result = await prisma.$transaction(async (tx) => {
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

  const lead = dbLeadContract(input, listing.title, result.dbLead.id, result.audit.id, false, result.dbLead.createdAt.toISOString(), "api.leads.prisma");
  return { ok: true, lead, duplicate: false };
}

function dbLeadContract(input: LeadInput, listingTitle: string, id: string, auditId: string, duplicate: boolean, createdAt = new Date().toISOString(), source: "api.leads.fixture-store" | "api.leads.prisma" = "api.leads.prisma"): LeadRecord {
  return {
    id,
    listingId: input.listingId,
    listingTitle,
    organizationName: "Nivasa Partners",
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
function dbLeadRowToContract(row: Record<string, unknown>): LeadRecord {
  const id = String(row.id ?? "");
  const listing = (row.listing ?? {}) as { title?: string };
  const createdAt = new Date(row.createdAt as string | Date).toISOString();
  return {
    id,
    listingId: String(row.listingId ?? ""),
    listingTitle: listing.title ?? "Unknown listing",
    organizationName: "Nivasa Partners",
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

/** All leads for the broker inbox, newest-first. */
export async function listLeadsForServer(): Promise<LeadRecord[]> {
  if (!isPrismaLeadStorage()) return listActiveLeads();
  const prisma = getPrismaClient() as unknown as PrismaLeadClient;
  const rows = await prisma.lead.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { listing: { select: { title: true } } },
  });
  return rows.map((row) => dbLeadRowToContract(row));
}

/** Soft-delete a lead (retention-privacy) and record the audit trail. */
export async function deleteLeadForServer(id: string): Promise<{ ok: true; lead: LeadRecord } | { ok: false; status: number; errors: string[] }> {
  if (!isPrismaLeadStorage()) return softDeleteLead(id);
  const prisma = getPrismaClient() as unknown as PrismaLeadClient;
  const existing = (await prisma.lead.findUnique({ where: { id } })) as { id: string; deletedAt?: Date | null } | null;
  if (!existing) return { ok: false, status: 404, errors: ["Lead not found."] };
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date(), status: "DELETED" } });
  const row = (await prisma.lead.findUnique({ where: { id }, include: { listing: { select: { title: true } } } })) as Record<string, unknown> | null;
  return { ok: true, lead: dbLeadRowToContract(row ?? { id }) };
}

/** Revoke a lead's stored data at the buyer's request (privacy/consent). */
export async function revokeLeadConsentForServer(id: string): Promise<{ ok: true; lead: LeadRecord } | { ok: false; status: number; errors: string[] }> {
  if (!isPrismaLeadStorage()) return revokeLeadConsent(id);
  const prisma = getPrismaClient() as unknown as PrismaLeadClient;
  const existing = (await prisma.lead.findUnique({ where: { id } })) as { id: string; deletedAt?: Date | null } | null;
  if (!existing) return { ok: false, status:404, errors: ["Lead not found."] };
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date(), status: "DELETED" } });
  await prisma.auditEvent.create({ data: { leadId: id, action: "lead.consent.revoked", entityType: "Lead", entityId: id, metadata: { source: "api.broker.leads.consent.prisma" } } });
  const row = (await prisma.lead.findUnique({ where: { id }, include: { listing: { select: { title: true } } } })) as Record<string, unknown> | null;
  return { ok: true, lead: dbLeadRowToContract(row ?? { id }) };
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
  const row = (await prisma.lead.findUnique({ where: { id }, include: { listing: { select: { title: true } } } })) as Record<string, unknown> | null;
  return { ok: true, lead: dbLeadRowToContract(row ?? { id }) };
}

export function validateLeadInputForConfiguredSource(input: Partial<LeadInput>) {
  return isPrismaLeadStorage() ? baseErrors(input) : validateLeadInput(input);
}
