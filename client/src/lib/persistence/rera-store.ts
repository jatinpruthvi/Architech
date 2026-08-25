import "server-only";
import { requestReraCorrection, markReraStale, resolveReraCorrection, type ReraCorrectionInput, type ReraCorrectionStatus } from "@/lib/rera/rera";
import { isPrismaPersistence } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

type ReraPrismaClient = ReturnType<typeof getPrismaClient> & {
  reraRecord: {
    upsert(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  auditEvent: { create(args: unknown): Promise<unknown> };
};

const prisma = () => getPrismaClient() as unknown as ReraPrismaClient;

/** Persist a RERA correction request. Write-through: validate/contract in the
    domain module, then record the update for durability when configured. */
export async function requestReraCorrectionForServer(input: ReraCorrectionInput) {
  const result = requestReraCorrection(input);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await db.reraRecord.upsert({
      where: { registrationNumber: result.correction.registrationNumber },
      update: { verificationStatus: "DISPUTED", correctionStatus: result.correction.status },
      create: { registrationNumber: result.correction.registrationNumber, state: "Gujarat", verificationStatus: "DISPUTED", correctionStatus: result.correction.status },
    });
    await db.auditEvent.create({
      data: { action: "rera.correction.requested", entityType: "ReraRecord", entityId: result.correction.registrationNumber, metadata: { field: result.correction.field, source: "api.rera.corrections.prisma" } },
    });
  }
  return result;
}

type ReraContractSuccess = { ok: true; record: { registrationNumber: string } };

export async function markReraStaleForServer(registrationNumber: string, reason = "Scheduled freshness check required.") {
  const result = markReraStale(registrationNumber, reason);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    const record = (result as ReraContractSuccess).record;
    await db.reraRecord.update({
      where: { registrationNumber: record.registrationNumber },
      data: { verificationStatus: "STALE" },
    });
    await db.auditEvent.create({
      data: { action: "rera.record.marked_stale", entityType: "ReraRecord", entityId: record.registrationNumber, metadata: { reason, source: "api.admin.rera.refresh.prisma" } },
    });
  }
  return result;
}

export async function resolveReraCorrectionForServer(correctionId: string, status: Exclude<ReraCorrectionStatus, "NONE" | "REQUESTED">, note: string) {
  const result = resolveReraCorrection(correctionId, status, note);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    const record = (result as ReraContractSuccess).record;
    await db.reraRecord.update({
      where: { registrationNumber: record.registrationNumber },
      data: { verificationStatus: status === "RESOLVED" ? "VERIFIED" : "DISPUTED", correctionStatus: status },
    });
    await db.auditEvent.create({
      data: { action: `rera.correction.${status.toLowerCase()}`, entityType: "ReraRecord", entityId: record.registrationNumber, metadata: { note, source: "api.rera.corrections.prisma" } },
    });
  }
  return result;
}
