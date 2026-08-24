import "server-only";
import { createLead, maskPhone, validateLeadInput, type LeadInput, type LeadRecord, type LeadResult } from "./lead";
import { isPrismaLeadStorage } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

type PrismaLeadClient = ReturnType<typeof getPrismaClient> & {
  listing: { findFirst(args: unknown): Promise<{ id: string; title: string; brokerOrgId?: string | null } | null> };
  lead: { findUnique(args: unknown): Promise<unknown | null>; create(args: unknown): Promise<{ id: string; createdAt: Date }> };
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
    createdAt,
  };
}

export function validateLeadInputForConfiguredSource(input: Partial<LeadInput>) {
  return isPrismaLeadStorage() ? baseErrors(input) : validateLeadInput(input);
}
