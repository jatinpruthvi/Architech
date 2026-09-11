import "server-only";
import { reviewGuide, type GuideReviewAction, type GuideReviewRecord } from "@/lib/content/workflow";
import { getGuides, type Guide } from "@/lib/repositories";
import { demoBrokerSession, type AuthSession } from "@/lib/auth/roles";
import { isPrismaPersistence } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

/* Server-only write-through store for guide editorial review.

   The workflow in `content/workflow.ts` is pure; this store keeps the durable
   record. In fixture mode the record is in-memory (the preview can walk the
   approval journey); in prisma mode each decision is also written as an
   AuditEvent so an approval is traceable to an actor and timestamp. The guide
   content itself is still the static registry — a database-backed guide CMS is
   a content/editorial backlog (needs an editorial owner, §9/§10), not a code
   gap. */

/* bounded-state: one record per guide id, and the key set is the static guide
   registry (never request input), so the entry count is fixed by the content
   corpus — an editorial decision, not a traffic-bound leak. */
const reviewRecordsByGuideId = new Map<string, GuideReviewRecord>();

export type GuideReviewResult =
  | { ok: true; record: GuideReviewRecord }
  | { ok: false; status: 404 | 409; errors: string[] };

/** Current review record, defaulting to `draft` for a guide never reviewed. */
export function getGuideReviewRecord(guideId: string): GuideReviewRecord {
  return reviewRecordsByGuideId.get(guideId) ?? { guideId, status: "draft", events: [] };
}

/** Reset the in-memory record — a test hook, not a product surface. */
export function resetGuideReviewRecords(): void {
  reviewRecordsByGuideId.clear();
}

export async function reviewGuideForServer(
  guide: Guide,
  action: GuideReviewAction,
  reason: string | undefined,
  session: AuthSession = demoBrokerSession,
): Promise<GuideReviewResult> {
  const record = getGuideReviewRecord(guide.id);
  const result = reviewGuide(guide, record, action, session.user.id, new Date().toISOString(), reason);
  if (!result.ok) return { ok: false, status: 409, errors: [result.error] };
  reviewRecordsByGuideId.set(guide.id, result.record);
  if (isPrismaPersistence()) {
    try {
      const db = getPrismaClient() as unknown as {
        auditEvent: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
      };
      await db.auditEvent.create({
        data: {
          action: `guide.review.${action}`,
          entityType: "Guide",
          entityId: guide.id,
          metadata: { from: record.status, to: result.record.status, actor: session.user.id, reason: reason ?? null },
        },
      });
    } catch (error) {
      return { ok: false, status: 409, errors: [error instanceof Error ? error.message : "Could not record the review decision."] };
    }
  }
  return { ok: true, record: result.record };
}

/** Resolve a guide by id for the route; undefined when the id is unknown. */
export function resolveGuide(guideId: string): Guide | undefined {
  return getGuides().find((guide) => guide.id === guideId);
}
