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
 *    PAUSED/EXPIRED/CANCELLED map to EXPIRED; no subscription is NONE.
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
  })) as { status: string } | null;
  if (!subscription) return "NONE";
  if (subscription.status === "TRIAL") return "TRIAL";
  if (subscription.status === "ACTIVE") return "ACTIVE";
  return "EXPIRED";
}
