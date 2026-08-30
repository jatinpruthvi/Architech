/* Media retention runtime (M-6).
 *
 * `retention.ts` defined policy — pending 30d, rejected 14d, takedown 7d,
 * approved while live — but nothing ever ran it: stale media sat in PENDING
 * and REJECTED indefinitely, and takedown-requested files were only removed
 * if a moderator acted. This module is the runtime half:
 *
 *   1. `runMediaRetentionSweep()` scans live media records and applies the
 *      policy (expired/non-approved → removed from display via DELETED, with
 *      a `media.retention.enforced` audit event in Prisma mode).
 *   2. `registerMediaRetentionRuntime()` schedules the sweep in-process from
 *      `instrumentation.ts` (the same startup point the SEO spine uses). The
 *      interval is configurable via `MEDIA_RETENTION_SWEEP_INTERVAL_MINUTES`
 *      (default 60) and can be disabled with `MEDIA_RETENTION_SWEEP=off`.
 *
 * Like the event spine, this is an in-process scheduler: it is reliable on a
 * long-lived Node server and deliberately absent on serverless instances,
 * where the exported sweep should instead be driven by a platform cron. */
import "server-only";
import { logger } from "@/lib/observability/logger";
import { isPrismaPersistence } from "@/lib/persistence/source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { applyRetentionDecision, listMediaUploadRecords, type MediaModerationStatus } from "./upload";
import { decideMediaRetention } from "./retention";

type RetentionRecord = {
  id: string;
  moderationStatus: MediaModerationStatus;
  exifStripped: boolean;
  createdAt: string;
};

type RetentionPrismaClient = ReturnType<typeof getPrismaClient> & {
  propertyMedia: {
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  auditEvent: { create(args: unknown): Promise<unknown> };
};

const prisma = () => getPrismaClient() as unknown as RetentionPrismaClient;

function ageDays(createdAt: string, now: Date): number {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  return Math.max(0, (now.getTime() - created.getTime()) / 86_400_000);
}

/** Scan every media record and apply the retention policy. Returns what was
    scanned and what was acted on, so operators/tests can see the sweep ran. */
export async function runMediaRetentionSweep(now = new Date()): Promise<{ scanned: number; acted: number; actedIds: string[] }> {
  const memoryRecords: RetentionRecord[] = listMediaUploadRecords();
  let prismaRecords: RetentionRecord[] = [];
  if (isPrismaPersistence()) {
    const rows = (await prisma().propertyMedia.findMany({
      select: { id: true, moderationStatus: true, exifStripped: true, createdAt: true },
    })) as Array<Record<string, unknown>>;
    prismaRecords = rows.map((row) => ({
      id: String(row.id ?? ""),
      moderationStatus: String(row.moderationStatus ?? "PENDING") as MediaModerationStatus,
      exifStripped: Boolean(row.exifStripped),
      createdAt: String(row.createdAt ?? ""),
    }));
  }

  const acted: string[] = [];
  for (const record of [...memoryRecords, ...prismaRecords]) {
    const decision = decideMediaRetention(record.moderationStatus, ageDays(record.createdAt, now));
    if (decision.act === "retain") continue;
    acted.push(record.id);
    applyRetentionDecision(record.id, decision.act, decision.reason, decision.policyId);
    if (isPrismaPersistence()) {
      await prisma().propertyMedia.updateMany({ where: { id: record.id }, data: { moderationStatus: "DELETED" } });
      await prisma().auditEvent.create({
        data: {
          action: "media.retention.enforced",
          entityType: "PropertyMedia",
          entityId: record.id,
          metadata: { act: decision.act, reason: decision.reason, policyId: decision.policyId },
        },
      });
    }
  }

  return { scanned: memoryRecords.length + prismaRecords.length, acted: acted.length, actedIds: [...new Set(acted)] };
}

/** Register the periodic sweep with the process runtime (instrumentation). */
export function registerMediaRetentionRuntime(): void {
  if (process.env.MEDIA_RETENTION_SWEEP === "off") return;
  const intervalMinutes = Math.max(1, Number(process.env.MEDIA_RETENTION_SWEEP_INTERVAL_MINUTES ?? 60) || 60);
  const run = () => {
    runMediaRetentionSweep()
      .then((result) => {
        if (result.acted > 0) {
          logger.info({ event: "media.retention.sweep", scanned: result.scanned, acted: result.acted });
        }
      })
      .catch((error: unknown) => {
        logger.error({ event: "media.retention.sweep_failed", error }, "media retention sweep failed");
      });
  };
  // First pass shortly after boot so a long-lived process does not retain stale
  // media for a full interval; `.unref()` keeps the interval from holding
  // shutdown open, mirroring the event-spine startup pattern.
  const first = setTimeout(run, 30_000);
  first.unref?.();
  const timer = setInterval(run, intervalMinutes * 60_000);
  timer.unref?.();
}
