import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { isPrismaLeadStorage } from "@/lib/leads/source";

export type OrgPlanStatus = "TRIAL" | "ACTIVE" | "EXPIRED" | "NONE";

/**
 * Per-organization plan status for the broker calling gate (spec §3).
 *
 * Precedence:
 * 1. An explicit ARCHITECH_BROKER_PLAN_STATUS is an operator override and wins everywhere.
 * 2. Fixture mode: organizations are ACTIVE (calling works out of the box in demos).
 * 3. Prisma: the organization's most recent MarketplaceSubscription — TRIAL/ACTIVE pass;
 *    PAUSED/EXPIRED/CANCELLED map to EXPIRED; no subscription is NONE. An
 *    ACTIVE/TRIAL row whose expiresAt has passed also resolves to EXPIRED.
 *
 * NOTE: `prisma` with no active subscription returns NONE by design — the owner's first
 * act after activating an org is opening /admin/plans and setting its plan (spec §3,
 * decision 5). Legacy env-only deployments keep working through the override above.
 */
export async function resolvePlanStatusForOrg(organizationId: string): Promise<OrgPlanStatus> {
  const explicit = process.env.ARCHITECH_BROKER_PLAN_STATUS;
  if (explicit && ["TRIAL", "ACTIVE", "EXPIRED", "NONE"].includes(explicit)) {
    return explicit as OrgPlanStatus;
  }
  if (!isPrismaLeadStorage()) {
    return "ACTIVE";
  }
  const prisma = getPrismaClient();
  /* "Most recent" per spec §3: startsAt desc, then id desc — a second
     subscription activated the same instant still resolves deterministically. */
  const subscription = (await prisma.marketplaceSubscription.findFirst({
    where: { organizationId },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
  })) as { status: string; expiresAt?: Date | string | null } | null;
  if (!subscription) return "NONE";
  const expiresAt = subscription.expiresAt == null ? null : new Date(subscription.expiresAt).getTime();
  const dateExpired = expiresAt !== null && Number.isFinite(expiresAt) && expiresAt <= Date.now();
  if (subscription.status === "TRIAL") return dateExpired ? "EXPIRED" : "TRIAL";
  if (subscription.status === "ACTIVE") return dateExpired ? "EXPIRED" : "ACTIVE";
  return "EXPIRED";
}

export interface OrgPlanSummary {
  status: OrgPlanStatus;
  planName: string | null;
  renewsAt: Date | null;
  expiresAt: Date | null;
}

/**
 * Display data for the workspace payment strip: the plan name and renewal
 * date from the org's most recent MarketplaceSubscription (same row and
 * ordering the calling gate reads), with the status verdict still coming
 * from resolvePlanStatusForOrg so operator overrides and fixture mode stay
 * consistent everywhere. The strip is informational — if the table is not
 * migrated yet (or the query fails) we degrade to the verdict alone instead
 * of taking the activities page down.
 */
export async function getOrgPlanSummary(organizationId: string): Promise<OrgPlanSummary> {
  const status = await resolvePlanStatusForOrg(organizationId);
  try {
    const prisma = getPrismaClient();
    const subscription = (await prisma.marketplaceSubscription.findFirst({
      where: { organizationId },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      select: { renewsAt: true, expiresAt: true, plan: { select: { name: true } } },
    })) as { renewsAt: Date | null; expiresAt: Date | null; plan: { name: string } | null } | null;
    if (!subscription) return { status, planName: null, renewsAt: null, expiresAt: null };
    return {
      status,
      planName: subscription.plan?.name ?? null,
      renewsAt: subscription.renewsAt,
      expiresAt: subscription.expiresAt,
    };
  } catch {
    return { status, planName: null, renewsAt: null, expiresAt: null };
  }
}
