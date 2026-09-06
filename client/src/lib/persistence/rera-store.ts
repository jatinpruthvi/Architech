import "server-only";
import { requestReraCorrection, markReraStale, resolveReraCorrection, type ReraCorrectionInput, type ReraCorrectionStatus, type ReraRecordSnapshot } from "@/lib/rera/rera";
import { verifyReraRecordForServer } from "@/lib/rera/server/provider";
import { isPrismaPersistence } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { liveCities } from "@/lib/cities";

type ReraPrismaClient = ReturnType<typeof getPrismaClient> & {
  reraRecord: {
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
    upsert(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  auditEvent: { create(args: unknown): Promise<unknown> };
};

const prisma = () => getPrismaClient() as unknown as ReraPrismaClient;

function stateName(stateSlug: string): string {
  return liveCities.find((city) => city.stateSlug === stateSlug)?.state
    ?? stateSlug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

/** Persist a RERA correction request. Write-through: validate/contract in the
    domain module, then record the update for durability when configured. */
export async function requestReraCorrectionForServer(input: ReraCorrectionInput) {
  const result = requestReraCorrection(input);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await db.reraRecord.upsert({
      where: {
        jurisdictionSlug_registrationNumber: {
          jurisdictionSlug: result.correction.stateSlug,
          registrationNumber: result.correction.registrationNumber,
        },
      },
      update: { state: stateName(result.correction.stateSlug), verificationStatus: "DISPUTED", correctionStatus: result.correction.status },
      create: {
        jurisdictionSlug: result.correction.stateSlug,
        registrationNumber: result.correction.registrationNumber,
        state: stateName(result.correction.stateSlug),
        verificationStatus: "DISPUTED",
        correctionStatus: result.correction.status,
      },
    });
    await db.auditEvent.create({
      data: { action: "rera.correction.requested", entityType: "ReraRecord", entityId: `${result.correction.stateSlug}:${result.correction.registrationNumber}`, metadata: { field: result.correction.field, source: "api.rera.corrections.prisma" } },
    });
  }
  return result;
}

type ReraContractSuccess = { ok: true; record: { stateSlug: string; registrationNumber: string } };

export async function markReraStaleForServer(stateSlug: string, registrationNumber: string, reason = "Scheduled freshness check required.") {
  const result = markReraStale(stateSlug, registrationNumber, reason);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    const record = (result as ReraContractSuccess).record;
    await db.reraRecord.update({
      where: { jurisdictionSlug_registrationNumber: { jurisdictionSlug: record.stateSlug, registrationNumber: record.registrationNumber } },
      data: { verificationStatus: "STALE" },
    });
    await db.auditEvent.create({
      data: { action: "rera.record.marked_stale", entityType: "ReraRecord", entityId: `${record.stateSlug}:${record.registrationNumber}`, metadata: { reason, source: "api.admin.rera.refresh.prisma" } },
    });
  }
  return result;
}

/* Map the provider's snapshot status onto the DB VerificationStatus enum.
   Only an authority-CONFIRMED record may be restored to verified; anything
   else (not found, disputed, stale) must NOT be upgraded — the whole point of
   STALE is "freshness unconfirmed", and a refresh that fabricates a badge
   would be worse than the staleness it is meant to clear. */
function snapshotStatusToDb(status: ReraRecordSnapshot["verificationStatus"]): "RERA_VERIFIED" | "DISPUTED" | "STALE" | null {
  if (status === "VERIFIED") return "RERA_VERIFIED";
  if (status === "DISPUTED") return "DISPUTED";
  if (status === "STALE") return "STALE";
  return null; /* NOT_FOUND — leave the row as-is */
}

/** Re-verify STALE RERA records against the configured provider and restore
    freshness only when the authority confirms. Driven by the platform cron
    (cost-reduction-audit P1.7) rather than per-page requests. Conservative on
    purpose: a record the provider cannot confirm stays STALE. */
export async function refreshStaleReraRecordsForServer(limit = 10) {
  if (!isPrismaPersistence()) return { ok: true as const, scanned: 0, refreshed: 0, skipped: true, reason: "RERA refresh requires Prisma persistence." };
  const db = prisma();
  const rows = await db.reraRecord.findMany({
    where: { verificationStatus: "STALE" },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
  let refreshed = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const jurisdictionSlug = String(row.jurisdictionSlug);
    const registrationNumber = String(row.registrationNumber);
    const entityId = `${jurisdictionSlug}:${registrationNumber}`;
    let result;
    try {
      result = await verifyReraRecordForServer(jurisdictionSlug, registrationNumber);
    } catch (error) {
      errors.push(`${entityId}: ${error instanceof Error ? error.message : "provider error"}`);
      continue;
    }
    if (!result.ok || !result.record) {
      /* Not found / jurisdiction unsupported / provider failure: stay STALE. */
      continue;
    }
    const nextStatus = snapshotStatusToDb(result.record.verificationStatus);
    if (nextStatus === null) continue;
    await db.reraRecord.upsert({
      where: { jurisdictionSlug_registrationNumber: { jurisdictionSlug, registrationNumber } },
      update: {
        state: result.record.state,
        promoterName: result.record.promoterName,
        projectName: result.record.projectName,
        sourceUrl: result.record.sourceUrl,
        retrievedAt: new Date(result.record.retrievedAt),
        parserVersion: result.record.parserVersion,
        confidence: result.record.confidence,
        evidence: result.record.evidence,
        verificationStatus: nextStatus,
      },
      create: {
        jurisdictionSlug,
        registrationNumber,
        state: result.record.state,
        promoterName: result.record.promoterName,
        projectName: result.record.projectName,
        sourceUrl: result.record.sourceUrl,
        retrievedAt: new Date(result.record.retrievedAt),
        parserVersion: result.record.parserVersion,
        confidence: result.record.confidence,
        evidence: result.record.evidence,
        verificationStatus: nextStatus,
      },
    });
    await db.auditEvent.create({
      data: { action: "rera.record.refreshed", entityType: "ReraRecord", entityId, metadata: { verificationStatus: nextStatus, source: "scheduled.rera.refresh.prisma" } },
    });
    refreshed += 1;
  }
  return { ok: errors.length === 0, scanned: rows.length, refreshed, errors };
}

export async function resolveReraCorrectionForServer(correctionId: string, status: Exclude<ReraCorrectionStatus, "NONE" | "REQUESTED">, note: string) {
  const result = resolveReraCorrection(correctionId, status, note);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    const record = (result as ReraContractSuccess).record;
    await db.reraRecord.update({
      where: { jurisdictionSlug_registrationNumber: { jurisdictionSlug: record.stateSlug, registrationNumber: record.registrationNumber } },
      data: { verificationStatus: status === "RESOLVED" ? "RERA_VERIFIED" : "DISPUTED", correctionStatus: status },
    });
    await db.auditEvent.create({
      data: { action: `rera.correction.${status.toLowerCase()}`, entityType: "ReraRecord", entityId: `${record.stateSlug}:${record.registrationNumber}`, metadata: { note, source: "api.rera.corrections.prisma" } },
    });
  }
  return result;
}
