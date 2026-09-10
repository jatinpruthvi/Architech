import "server-only";
import { createHash } from "node:crypto";
import { assertLeadBelongsToOrg } from "./server";
import { findLeadForOrganization, getFixtureLeadContact } from "./lead";
import { isPrismaLeadStorage } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { decryptContact } from "@/lib/interop/contact-crypto";
import { normalizeIndianPhone, telLink, waMeLink } from "@/lib/interop/phone";
import { CALL_OUTCOMES, OUTCOME_RULES, nextStageFor, planAllowsReveal, type BrokerPlanStatus, type CallOutcome, type LeadStage } from "./calling";

const DEMO_CONTACTS: Record<string, string> = {
  lead_prototype_hot: "+919876543210",
  lead_prototype_followup: "+919876543210",
  lead_prototype_attempts: "+919876543210",
  lead_prototype_suppressed: "+919876543210",
};
const DEMO_CALL_STATE: Record<string, { attempts: number; suppressed: boolean }> = {
  lead_prototype_hot: { attempts: 0, suppressed: false },
  lead_prototype_followup: { attempts: 1, suppressed: false },
  lead_prototype_attempts: { attempts: 3, suppressed: false },
  lead_prototype_suppressed: { attempts: 2, suppressed: true },
};

function planStatus(): BrokerPlanStatus {
  const value = process.env.ARCHITECH_BROKER_PLAN_STATUS;
  return value === "NONE" || value === "TRIAL" || value === "EXPIRED" ? value : "ACTIVE";
}

function attemptLimit(): number {
  const value = process.env.ARCHITECH_LEAD_CALL_ATTEMPT_LIMIT ?? "3";
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 20 ? parsed : 3;
}

function callingWindow(): string {
  return process.env.ARCHITECH_CALLING_HOURS_IST ?? "09:00-20:00";
}

function ipHash(request: Request): string | undefined {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  return ip ? createHash("sha256").update(ip).digest("hex") : undefined;
}

function validOutcome(value: unknown): value is CallOutcome {
  return typeof value === "string" && (CALL_OUTCOMES as readonly string[]).includes(value);
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function revealLeadContact(request: Request, leadId: string, organizationId: string) {
  const isDemoFixture = !isPrismaLeadStorage() && Boolean(DEMO_CONTACTS[leadId]);
  if (!isDemoFixture) {
    const owned = await assertLeadBelongsToOrg(leadId, organizationId);
    if (!owned.ok) return owned;
  }
  const now = new Date();
  if (!planAllowsReveal(planStatus())) return { ok: false as const, status: 402, errors: ["Activate a broker plan to reveal buyer numbers."] };

  if (!isPrismaLeadStorage()) {
    const lead = findLeadForOrganization(leadId, organizationId);
    const raw = getFixtureLeadContact(leadId) ?? DEMO_CONTACTS[leadId] ?? null;
    const demoLead = !lead && DEMO_CONTACTS[leadId] ? { consentClass: "first-party-form" } : lead;
    if (!demoLead || !raw) return { ok: false as const, status: 404, errors: ["Number not available for this enquiry."] };
    if (demoLead.consentClass === "portal-shared" || demoLead.consentClass === "aggregator-shared") return { ok: false as const, status: 403, errors: ["This buyer's consent does not permit a phone call."] };
    const state = DEMO_CALL_STATE[leadId] ?? { attempts: 0, suppressed: false };
    if (state.suppressed) return { ok: false as const, status: 403, errors: ["This number is on the do-not-call list."] };
    if (state.attempts >= attemptLimit()) return { ok: false as const, status: 429, errors: ["Attempt limit reached. Log the last call result before trying again."] };
    const parsedHours = callingWindow().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    const minutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;
    const inHours = parsedHours ? minutes >= Number(parsedHours[1]) * 60 + Number(parsedHours[2]) && minutes < Number(parsedHours[3]) * 60 + Number(parsedHours[4]) : false;
    if (!inHours) return { ok: false as const, status: 403, errors: ["Outside permitted calling hours (09:00–20:00 IST)."] };
    const normalized = normalizeIndianPhone(raw);
    if (!normalized.ok) return { ok: false as const, status: 422, errors: [normalized.reason] };
    return { ok: true as const, telLink: telLink(normalized.e164), waMeLink: waMeLink(normalized.e164), revealed: true };
  }

  const db = getPrismaClient() as unknown as {
    lead: { findUnique(args: unknown): Promise<Record<string, unknown> | null> };
    auditEvent: { create(args: unknown): Promise<unknown> };
  };
  const row = await db.lead.findUnique({ where: { id: leadId } });
  if (!row || !row.phoneCiphertext) return { ok: false as const, status: 422, errors: ["Number not available for this enquiry."] };
  if (row.consentClass === "portal-shared" || row.consentClass === "aggregator-shared") return { ok: false as const, status: 403, errors: ["This buyer's consent does not permit a phone call."] };
  if (row.callSuppressedAt) return { ok: false as const, status: 403, errors: ["This number is on the do-not-call list."] };
  const attempts = Number(row.callAttempts ?? 0);
  if (attempts >= attemptLimit()) return { ok: false as const, status: 429, errors: ["Attempt limit reached. Log the last call result before trying again."] };
  const parsedHours = callingWindow().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  const minutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;
  const inHours = parsedHours ? minutes >= Number(parsedHours[1]) * 60 + Number(parsedHours[2]) && minutes < Number(parsedHours[3]) * 60 + Number(parsedHours[4]) : false;
  if (!inHours) return { ok: false as const, status: 403, errors: ["Outside permitted calling hours (09:00–20:00 IST)."] };
  const phone = decryptContact(row.phoneCiphertext as Uint8Array);
  await db.auditEvent.create({ data: { leadId, organizationId, action: "lead.contact.revealed", entityType: "Lead", entityId: leadId, ipHash: ipHash(request), metadata: { channel: "tel", planStatus: planStatus() } } });
  return { ok: true as const, telLink: telLink(phone), waMeLink: waMeLink(phone), revealed: true };
}

export async function logLeadCall(leadId: string, organizationId: string, actorUserId: string | null, input: { outcome?: unknown; nextActionAt?: unknown; note?: unknown; lostReason?: unknown }) {
  if (!validOutcome(input.outcome)) return { ok: false as const, status: 400, errors: ["Choose a valid call outcome."] };
  const outcome = input.outcome;
  const rule = OUTCOME_RULES[outcome];
  const nextActionAt = parseDate(input.nextActionAt);
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : null;
  const lostReason = typeof input.lostReason === "string" ? input.lostReason.trim().slice(0, 500) : null;
  if (rule.requires !== "LOST_REASON" && rule.requires !== "NOTHING" && !nextActionAt) return { ok: false as const, status: 400, errors: ["A next action time is required for this outcome."] };
  if (rule.requires === "LOST_REASON" && (!lostReason || lostReason.length < 3)) return { ok: false as const, status: 400, errors: ["A reason is required before marking the lead lost."] };

  const isDemoFixture = !isPrismaLeadStorage() && Boolean(DEMO_CONTACTS[leadId]);
  if (!isDemoFixture) {
    const owned = await assertLeadBelongsToOrg(leadId, organizationId);
    if (!owned.ok) return owned;
  }

  if (!isPrismaLeadStorage()) {
    const current: LeadStage = "NEW";
    const entry = { outcome, stageBefore: current, stageAfter: nextStageFor(current, outcome), nextActionAt: nextActionAt?.toISOString() ?? null, note, lostReason };
    return { ok: true as const, call: entry };
  }

  const db = getPrismaClient() as unknown as {
    lead: { findUnique(args: unknown): Promise<Record<string, unknown> | null>; update(args: unknown): Promise<unknown> };
    leadCallLog: { create(args: unknown): Promise<Record<string, unknown>> };
  };
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false as const, status: 404, errors: ["Lead not found."] };
  const stageBefore = (typeof lead.stage === "string" ? lead.stage : "NEW") as LeadStage;
  const stageAfter = nextStageFor(stageBefore, outcome);
  const call = await db.leadCallLog.create({ data: { leadId, actorUserId, organizationId, outcome, note, lostReason, stageBefore, stageAfter, nextActionAt } });
  await db.lead.update({ where: { id: leadId }, data: { stage: stageAfter, callAttempts: { increment: 1 }, callSuppressedAt: rule.suppressesContact ? new Date() : undefined } });
  return { ok: true as const, call: { ...call, stageBefore, stageAfter } };
}
