import "server-only";

/* Plan administration for the owner's /admin/plans surface (spec §7).
   Every write is audited with the previous status in metadata — the ledger
   the strategy doc wants for "who got access, when, under which plan" —
   even before the usage-ledger surface exists. */

export type Db = Record<string, unknown> & {
  user: { findUnique(args: unknown): Promise<Record<string, unknown> | null> };
  marketplacePlan: {
    findUnique(args: unknown): Promise<Record<string, unknown> | null>;
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
    count(args?: unknown): Promise<number>;
    create(args: unknown): Promise<Record<string, unknown>>;
  };
  marketplaceSubscription: {
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
    update(args: unknown): Promise<Record<string, unknown>>;
    create(args: unknown): Promise<Record<string, unknown>>;
  };
  auditEvent: { create(args: unknown): Promise<unknown> };
  $transaction(fn: (tx: Db) => Promise<unknown>): Promise<unknown>;
};

const PLAN_STATUSES = ["TRIAL", "ACTIVE", "EXPIRED"] as const;
export type AdminPlanStatus = (typeof PLAN_STATUSES)[number];
export function isAdminPlanStatus(value: unknown): value is AdminPlanStatus {
  return typeof value === "string" && (PLAN_STATUSES as readonly string[]).includes(value);
}

/** The value shown to the owner must match the server-side gate. A stored
    ACTIVE/TRIAL row becomes effectively expired as soon as its optional date
    passes; no background job is required to flip the database enum. */
export function effectiveAdminPlanStatus(status: string, expiresAt: unknown, now = Date.now()): string {
  if ((status !== "ACTIVE" && status !== "TRIAL") || expiresAt == null) return status;
  const timestamp = expiresAt instanceof Date ? expiresAt.getTime() : new Date(String(expiresAt)).getTime();
  return Number.isFinite(timestamp) && timestamp <= now ? "EXPIRED" : status;
}

function asDate(value: unknown): Date | null {
  if (value == null) return null;
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function nullableIsoDate(value: unknown): string | null {
  return asDate(value)?.toISOString() ?? null;
}

function isoDate(value: unknown): string {
  return asDate(value)?.toISOString() ?? "";
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function orgRowOf(row: Record<string, unknown> | null): { id: string; name: string; slug: string; cityId: string | null } | null {
  if (!row) return null;
  const memberships = Array.isArray(row.brokerMemberships) ? (row.brokerMemberships as Array<Record<string, unknown>>) : [];
  if (memberships.length === 0) return null;
  const organization = (memberships[0] as { organization?: Record<string, unknown> }).organization ?? {};
  return { id: String(organization.id ?? ""), name: String(organization.name ?? ""), slug: String(organization.slug ?? ""), cityId: organization.cityId == null ? null : String(organization.cityId) };
}

export async function lookupOrganizationForLogin(
  prisma: Db,
  email: string,
): Promise<
  | { found: true; user: { name: string; email: string; role: string }; organization: { id: string; name: string; slug: string; cityId: string | null }; currentSubscription: { id: string; status: string; expiresAt: string | null; plan: { name: string; code: string } } | null }
  | { found: false }
> {
  const user = (await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, name: true, email: true, role: true, brokerMemberships: { where: { active: true }, orderBy: { createdAt: "desc" }, select: { organizationId: true, organization: { select: { id: true, name: true, slug: true, cityId: true } } } } },
  })) as Record<string, unknown> | null;
  const organization = orgRowOf(user);
  if (!user || !organization) return { found: false };
  const sub = (await prisma.marketplaceSubscription.findFirst({ where: { organizationId: organization.id }, orderBy: [{ startsAt: "desc" }, { id: "desc" }], select: { id: true, status: true, expiresAt: true, plan: { select: { name: true, code: true } } } })) as Record<string, unknown> | null;
  return {
    found: true,
    user: { name: String(user.name ?? user.email), email: String(user.email), role: String(user.role ?? "BUYER") },
    organization,
    currentSubscription: sub
      ? { id: String(sub.id), status: effectiveAdminPlanStatus(String(sub.status), sub.expiresAt), expiresAt: nullableIsoDate(sub.expiresAt), plan: { name: String((sub.plan as { name?: string })?.name ?? ""), code: String((sub.plan as { code?: string })?.code ?? "") } }
      : null,
  };
}

export async function listPlanAdministration(
  prisma: Db,
): Promise<{ plans: Array<{ id: string; code: string; name: string; monthlyCredits: number; teamSeats: number }>; subscriptions: Array<{ id: string; status: string; expiresAt: string | null; updatedAt: string; plan: { name: string }; organization: { name: string; slug: string } }> }> {
  /* ARCH-17: plan definitions are a tiny owner-managed registry; 100 is a
     generous cap that keeps the query bounded by construction. */
  const PLAN_ADMIN_CAP = 100;
  const [plans, subscriptions] = await Promise.all([
    prisma.marketplacePlan.findMany({ where: { active: true }, orderBy: { name: "asc" }, take: PLAN_ADMIN_CAP, select: { id: true, code: true, name: true, monthlyCredits: true, teamSeats: true } }),
    prisma.marketplaceSubscription.findMany({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 50, select: { id: true, status: true, expiresAt: true, updatedAt: true, plan: { select: { name: true } }, organization: { select: { name: true, slug: true } } } }),
  ]);
  return {
    plans: plans.map((row) => ({ id: String(row.id), code: String(row.code), name: String(row.name), monthlyCredits: Number(row.monthlyCredits ?? 0), teamSeats: Number(row.teamSeats ?? 1) })),
    subscriptions: subscriptions.map((row) => ({ id: String(row.id), status: effectiveAdminPlanStatus(String(row.status), row.expiresAt), expiresAt: nullableIsoDate(row.expiresAt), updatedAt: isoDate(row.updatedAt), plan: { name: String((row.plan as { name?: string })?.name ?? "") }, organization: { name: String((row.organization as { name?: string })?.name ?? ""), slug: String((row.organization as { slug?: string })?.slug ?? "") } })),
  };
}

export async function applyPlanToOrganization(
  prisma: Db,
  input: { email: string; planId: string | undefined; status: AdminPlanStatus; expiresAt: Date | null; ipHash: string | undefined },
): Promise<{ ok: true; organization: { id: string; name: string; slug: string }; subscription: { id: string; status: string; expiresAt: string | null }; previousStatus: string | null } | { ok: false; error: "ORG_NOT_FOUND" | "PLAN_NOT_FOUND" | "EXPIRY_INVALID" }> {
  const expiresAt = input.status === "EXPIRED" ? null : input.expiresAt;
  if (expiresAt) {
    const timestamp = expiresAt.getTime();
    if (!Number.isFinite(timestamp) || ((input.status === "ACTIVE" || input.status === "TRIAL") && timestamp <= Date.now())) {
      return { ok: false as const, error: "EXPIRY_INVALID" as const };
    }
  }
  return (await prisma.$transaction(async (tx) => {
    /* Organization first: an unknown login id is ORG_NOT_FOUND regardless of
       the plan asked for (uniform "that thing does not exist", no oracle). */
    const user = (await tx.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
      select: { id: true, brokerMemberships: { where: { active: true }, orderBy: { createdAt: "desc" }, select: { organization: { select: { id: true, name: true, slug: true } } } } },
    })) as Record<string, unknown> | null;
    const organization = orgRowOf(user);
    if (!user || !organization) return { ok: false as const, error: "ORG_NOT_FOUND" as const };
    let plan = (input.planId ? await tx.marketplacePlan.findUnique({ where: { id: input.planId } }) : null) as Record<string, unknown> | null;
    if (!plan) {
      // No usable plan: either the requested planId is unknown, or none was
      // sent. A request with a known-id-less planId is an error; a request
      // with no planId against an EMPTY plan table seeds the default.
      if (input.planId) return { ok: false as const, error: "PLAN_NOT_FOUND" as const };
      const planCount = await tx.marketplacePlan.count();
      if (planCount === 0) {
        plan = await tx.marketplacePlan.create({ data: { code: "broker-pro", name: "Broker Pro", monthlyCredits: 0, teamSeats: 1, active: true } });
      } else {
        return { ok: false as const, error: "PLAN_NOT_FOUND" as const };
      }
    }
    const current = (await tx.marketplaceSubscription.findFirst({ where: { organizationId: organization.id }, orderBy: [{ startsAt: "desc" }, { id: "desc" }], select: { id: true, status: true } })) as Record<string, unknown> | null;
    const previousStatus = current ? String(current.status) : null;
    const subscription = (current
      ? await tx.marketplaceSubscription.update({ where: { id: String(current.id) }, data: { planId: String(plan!.id), status: input.status, expiresAt } })
      : await tx.marketplaceSubscription.create({ data: { planId: String(plan!.id), organizationId: organization.id, status: input.status, expiresAt } })) as Record<string, unknown>;
    await tx.auditEvent.create({ data: { organizationId: organization.id, action: "admin.plan.updated", entityType: "MarketplaceSubscription", entityId: String(subscription.id), ipHash: input.ipHash, metadata: { loginEmail: input.email.trim().toLowerCase(), planCode: String(plan!.code), previousStatus, status: input.status, expiresAt: expiresAt ? expiresAt.toISOString() : null } } });
    return { ok: true as const, organization: { id: organization.id, name: organization.name, slug: organization.slug }, subscription: { id: String(subscription.id), status: effectiveAdminPlanStatus(String(subscription.status), subscription.expiresAt), expiresAt: nullableIsoDate(subscription.expiresAt) }, previousStatus };
  })) as Awaited<ReturnType<typeof applyPlanToOrganization>>;
}

export async function createPlanDefinition(prisma: Db, input: { name: string; ipHash: string | undefined }): Promise<{ ok: true; plan: { id: string; code: string; name: string } } | { ok: false; error: "NAME_INVALID" | "CODE_TAKEN" }> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return { ok: false, error: "NAME_INVALID" };
  const code = slugify(name);
  if (code.length < 2) return { ok: false, error: "NAME_INVALID" };
  const existing = await prisma.marketplacePlan.findUnique({ where: { code } });
  if (existing) return { ok: false, error: "CODE_TAKEN" };
  const plan = await prisma.marketplacePlan.create({ data: { code, name, monthlyCredits: 0, teamSeats: 1, active: true } });
  await prisma.auditEvent.create({ data: { action: "admin.plan.created", entityType: "MarketplacePlan", entityId: String(plan.id), ipHash: input.ipHash, metadata: { name, code } } });
  return { ok: true, plan: { id: String(plan.id), code, name } };
}
