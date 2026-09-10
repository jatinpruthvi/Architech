import "server-only";
import { findLeadForOrganization, type LeadDetailRecord } from "../leads/lead";
import { isPrismaLeadStorage } from "../leads/source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { assertLeadBelongsToOrg } from "../leads/server";

function safeIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function getLeadDetailForServer(id: string, organizationId: string): Promise<{ ok: true; lead: LeadDetailRecord } | { ok: false; status: number; errors: string[] }> {
  const owned = await assertLeadBelongsToOrg(id, organizationId);
  if (!owned.ok) return owned;
  if (!isPrismaLeadStorage()) {
    const lead = findLeadForOrganization(id, organizationId);
    if (!lead) return { ok: false, status: 404, errors: ["Lead not found."] };
    return { ok: true, lead: { ...lead, stage: "NEW", callAttempts: 0, maxAttempts: 3, suppressed: false, nextActionAt: null, callHistory: [] } };
  }
  const db = getPrismaClient() as unknown as { lead: { findFirst(args: unknown): Promise<Record<string, unknown> | null> } };
  const row = await db.lead.findFirst({ where: { id, organizationId, deletedAt: null }, include: { listing: { select: { title: true, stableId: true, brokerOrg: { select: { name: true } } } }, callLogs: { orderBy: { createdAt: "asc" } } } });
  if (!row) return { ok: false, status: 404, errors: ["Lead not found."] };
  const listing = (row.listing ?? {}) as { title?: string; stableId?: string; brokerOrg?: { name?: string } | null };
  const logs = Array.isArray(row.callLogs) ? row.callLogs as Array<Record<string, unknown>> : [];
  const lead: LeadDetailRecord = {
    id: String(row.id), listingId: String(row.listingId ?? listing.stableId ?? ""), listingTitle: listing.title ?? "Unknown listing", organizationId: typeof row.organizationId === "string" ? row.organizationId : null, organizationName: listing.brokerOrg?.name ?? "Verified partner", name: String(row.name ?? ""), phoneMasked: String(row.phoneMasked ?? ""), email: typeof row.email === "string" ? row.email : undefined, message: String(row.message ?? ""), mode: String(row.mode ?? "MASKED") as LeadRecord["mode"], status: String(row.status ?? "NEW") as LeadRecord["status"], consentText: String(row.consentText ?? ""), consentClass: typeof row.consentClass === "string" ? row.consentClass : undefined, idempotencyKey: String(row.idempotencyKey ?? ""), auditEvent: { id: `audit_${String(row.id)}`, action: "lead.created", entityType: "Lead", metadata: { masked: true, source: "api.leads.prisma" } }, statusHistory: [], createdAt: safeIso(row.createdAt), stage: String(row.stage ?? "NEW"), callAttempts: Number(row.callAttempts ?? 0), maxAttempts: 3, suppressed: Boolean(row.callSuppressedAt), nextActionAt: logs.length ? safeIso(logs.at(-1)?.nextActionAt) : null, callHistory: logs.map((log) => ({ outcome: String(log.outcome ?? ""), stageBefore: String(log.stageBefore ?? "NEW"), stageAfter: String(log.stageAfter ?? "NEW"), nextActionAt: log.nextActionAt ? safeIso(log.nextActionAt) : null, note: typeof log.note === "string" ? log.note : null, createdAt: safeIso(log.createdAt) })),
  };
  return { ok: true, lead };
}

export async function getLeadMetricsForServer(organizationId: string): Promise<{ overdue: number; outcomes: Record<string, number>; lostReasons: Record<string, number> }> {
  if (!organizationId || !isPrismaLeadStorage()) return { overdue: 0, outcomes: {}, lostReasons: {} };
  const db = getPrismaClient() as unknown as { leadCallLog: { findMany(args: unknown): Promise<Array<Record<string, unknown>>> } };
  const rows = await db.leadCallLog.findMany({ where: { organizationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5000, select: { outcome: true, lostReason: true, nextActionAt: true } });
  const outcomes: Record<string, number> = {};
  const lostReasons: Record<string, number> = {};
  let overdue = 0;
  const now = Date.now();
  for (const row of rows) {
    const outcome = String(row.outcome ?? "UNKNOWN");
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    if (row.nextActionAt && new Date(String(row.nextActionAt)).getTime() <= now) overdue += 1;
    if (typeof row.lostReason === "string" && row.lostReason.trim()) lostReasons[row.lostReason] = (lostReasons[row.lostReason] ?? 0) + 1;
  }
  return { overdue, outcomes, lostReasons };
}

import type { LeadRecord } from "../leads/lead";
