import "server-only";
import { createHash } from "node:crypto";
import { assertLeadBelongsToOrg } from "./server";
import { findLeadForOrganization, fixtureLeadDetail, getFixtureLeadContact, recordFixtureCall } from "./lead";
import { isPrismaLeadStorage } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { decryptContact } from "@/lib/interop/contact-crypto";
import { normalizeIndianPhone, telLink, waMeLink } from "@/lib/interop/phone";
import { CONSENT_CLASSES, consentPermissionsFor, type ConsentClassId } from "@/lib/interop/lead-ingestion";
import { CALL_OUTCOMES, isWithinCallingHours, nextStageFor, OUTCOME_RULES, parseCallingHours, planAllowsReveal, type CallOutcome, type LeadStage } from "./calling";
import { resolvePlanStatusForOrg } from "@/lib/plans/plan-status";

/* Gate order (pinned by calling-server.test.ts):
   ownership → plan → consent → suppression → stored → attempt limit → hours.
   The plan check is per-ORGANIZATION (Task 1 resolver) — no global env
   default can neutre the entitlement gate anymore. */

function attemptLimit(): number {
  const value = process.env.ARCHITECH_LEAD_CALL_ATTEMPT_LIMIT ?? "3";
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 20 ? parsed : 3;
}

/** Registry predicate (spec §5.1) — future consent classes get correct
    behaviour for free. An UNKNOWN class fails CLOSED (403, never a 500):
    consentPermissionsFor throws on ids the registry does not know. */
function consentAllowsHumanCall(consentClass: string | null | undefined): boolean {
  const value = consentClass ?? "first-party-form";
  if (!(value in CONSENT_CLASSES)) return false;
  return consentPermissionsFor(value as ConsentClassId).humanFirstTouch;
}

/** Shared IST-window check (spec §5.2) — reuses the pure helpers from
    calling.ts; the error copy names the CONFIGURED window, never a
    hardcoded one. An unparseable window fails closed (no calling). */
function outsideCallingHours(now: Date): { ok: false; status: 403; errors: string[] } | null {
  /* Unset env → the documented default window. An explicitly MALFORMED env
     value still fails closed (parseCallingHours → null). */
  const configured = process.env.ARCHITECH_CALLING_HOURS_IST ?? "09:00-20:00";
  const hours = parseCallingHours(configured);
  if (hours && isWithinCallingHours(now, hours)) return null;
  return { ok: false, status: 403, errors: [`Outside permitted calling hours (${configured} IST).`] };
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
  const owned = await assertLeadBelongsToOrg(leadId, organizationId);
  if (!owned.ok) return owned;
  const plan = await resolvePlanStatusForOrg(organizationId);
  if (!planAllowsReveal(plan)) return { ok: false as const, status: 402, errors: ["Activate a broker plan to reveal buyer numbers."] };

  if (!isPrismaLeadStorage()) {
    const lead = findLeadForOrganization(leadId, organizationId);
    if (!lead) return { ok: false as const, status: 404, errors: ["Lead not found."] };
    const raw = getFixtureLeadContact(leadId);
    if (!raw) return { ok: false as const, status: 422, errors: ["Number not available for this enquiry."] };
    if (!consentAllowsHumanCall(lead.consentClass)) return { ok: false as const, status: 403, errors: ["This buyer's consent does not permit a phone call."] };
    const state = fixtureLeadDetail(leadId, organizationId);
    if (state?.suppressed) return { ok: false as const, status: 403, errors: ["This number is on the do-not-call list."] };
    if ((state?.callAttempts ?? 0) >= attemptLimit()) return { ok: false as const, status: 429, errors: ["Attempt limit reached. Log the last call result before trying again."] };
    const blocked = outsideCallingHours(new Date());
    if (blocked) return blocked;
    const normalized = normalizeIndianPhone(raw);
    if (!normalized.ok) return { ok: false as const, status: 422, errors: [normalized.reason] };
    return { ok: true as const, telLink: telLink(normalized.e164), waMeLink: waMeLink(normalized.e164), revealed: true };
  }

  const db = getPrismaClient() as unknown as {
    lead: { findUnique(args: unknown): Promise<Record<string, unknown> | null> };
    auditEvent: { create(args: unknown): Promise<unknown> };
  };
  const row = await db.lead.findUnique({ where: { id: leadId } });
  if (!row) return { ok: false as const, status: 404, errors: ["Lead not found."] };
  /* Pre-migration leads have no ciphertext — 422 not-stored, never a 500. */
  if (!row.phoneCiphertext) return { ok: false as const, status: 422, errors: ["Number not available for this enquiry."] };
  if (!consentAllowsHumanCall(typeof row.consentClass === "string" ? row.consentClass : null)) return { ok: false as const, status: 403, errors: ["This buyer's consent does not permit a phone call."] };
  if (row.callSuppressedAt) return { ok: false as const, status: 403, errors: ["This number is on the do-not-call list."] };
  if (Number(row.callAttempts ?? 0) >= attemptLimit()) return { ok: false as const, status: 429, errors: ["Attempt limit reached. Log the last call result before trying again."] };
  const blocked = outsideCallingHours(new Date());
  if (blocked) return blocked;
  const phone = decryptContact(row.phoneCiphertext as Uint8Array);
  await db.auditEvent.create({ data: { leadId, organizationId, action: "lead.contact.revealed", entityType: "Lead", entityId: leadId, ipHash: ipHash(request), metadata: { channel: "tel", planStatus: plan } } });
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

  const owned = await assertLeadBelongsToOrg(leadId, organizationId);
  if (!owned.ok) return owned;
  /* Spec §3: the resolver runs in both calling operations — the plan gate
     applies to logging results, not only to revealing. */
  const plan = await resolvePlanStatusForOrg(organizationId);
  if (!planAllowsReveal(plan)) return { ok: false as const, status: 402, errors: ["Activate a broker plan to record call results."] };

  if (!isPrismaLeadStorage()) {
    const state = fixtureLeadDetail(leadId, organizationId);
    const stageBefore = (state?.stage ?? "NEW") as LeadStage;
    const stageAfter = nextStageFor(stageBefore, outcome);
    recordFixtureCall(leadId, { outcome, stageBefore, stageAfter, nextActionAt: nextActionAt?.toISOString() ?? null, note, lostReason });
    return { ok: true as const, call: { outcome, stageBefore, stageAfter, nextActionAt: nextActionAt?.toISOString() ?? null, note, lostReason } };
  }

  const db = getPrismaClient() as unknown as {
    lead: { findUnique(args: unknown): Promise<Record<string, unknown> | null>; update(args: unknown): Promise<unknown> };
    leadCallLog: { create(args: unknown): Promise<Record<string, unknown>> };
  };
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false as const, status: 404, errors: ["Lead not found."] };
  const stageBefore = (typeof lead.stage === "string" ? lead.stage : "NEW") as LeadStage;
  const stageAfter = nextStageFor(stageBefore, outcome);
  await db.leadCallLog.create({ data: { leadId, actorUserId, organizationId, outcome, note, lostReason, stageBefore, stageAfter, nextActionAt } });
  await db.lead.update({ where: { id: leadId }, data: { stage: stageAfter, callAttempts: { increment: 1 }, callSuppressedAt: rule.suppressesContact ? new Date() : undefined } });
  /* Contract shape, not the raw DB row: the route contract is
     `{ ok, call: { outcome, stageBefore, stageAfter, nextActionAt, … } }`. */
  return { ok: true as const, call: { outcome, stageBefore, stageAfter, nextActionAt: nextActionAt?.toISOString() ?? null, note, lostReason } };
}
