/* Live Better Auth server instance (server-only).
 *
 * The route/guard contract (`live.ts`) was configuration-complete but never
 * resolved a live session: with `ARCHITECH_AUTH_SOURCE=better-auth` and a
 * configured environment it always returned `{ session: null }`, so production
 * brokers could never authenticate.
 *
 * This module closes the gap by owning the single Better Auth instance and
 * exposing a token → claims resolver for `live-session.ts`. The database is the
 * in-memory adapter: Phase 1 has no Better Auth `Session`/`Account`/
 * `Verification` tables in `schema.prisma`, and this codebase keeps storage
 * choice explicit rather than pretending a Prisma adapter is wired. The
 * production handoff (docs/auth/live-better-auth-handoff.md) swaps `database`
 * for the Prisma adapter once those tables land; nothing else changes.
 *
 * `role` is a user additional field so a live session can carry the role the
 * demo contract already knows; it defaults to BUYER for plain sign-ups. */
import "server-only";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import type { BetterAuthClaims } from "./live";
import { BETTER_AUTH_SESSION_COOKIE } from "./live-session";
import { permissionsForRole, type AuthOrganization } from "./roles";
import { isPrismaPersistence } from "@/lib/persistence/source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

type AuthServer = ReturnType<typeof createAuthServer>;

let instance: AuthServer | undefined;

function createAuthServer() {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "BUYER" },
      },
    },
  });
}

/** The shared Better Auth instance (module singleton — sessions must be
    readable by every request in the process). */
export function getAuthServer(): AuthServer {
  if (!instance) instance = createAuthServer();
  return instance;
}

/** Resolve a Better Auth session token to the Architech claims shape, or null
    when the token is missing/expired/invalid.

    Permissions and organization are derived, never trusted from the sign-up
    payload: role→permissions comes from the application grant, and the
    organization comes from the `BrokerUser` membership row (Prisma mode).
    In fixture mode (dev/tests only) a broker-role account is attributed the
    demo organization so the wiring is exercisable before the adapter lands;
    production always requires real membership, so a broker without one
    cannot reach broker surfaces. */
export async function resolveBetterAuthClaims(token: string): Promise<BetterAuthClaims | null> {
  const auth = getAuthServer();
  const session = await auth.api.getSession({
    headers: { cookie: `${BETTER_AUTH_SESSION_COOKIE}=${encodeURIComponent(token)}` },
  });
  if (!session?.user) return null;
  const user = session.user as { id: string; name?: string | null; email: string; role?: string | null };
  const role = isAuthRole(user.role) ? user.role : "BUYER";
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role,
    permissions: permissionsForRole(role),
    organization: await resolveOrganizationForUser(user.id, role),
  };
}

const DEMO_BROKER_ORGANIZATION: AuthOrganization = {
  id: "demo-org-nivasa-partners",
  slug: "nivasa-partners",
  name: "Nivasa Partners",
  verificationStatus: "VERIFIED_PARTNER",
};

type MembershipClient = ReturnType<typeof getPrismaClient> & {
  brokerUser: {
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
  };
};

async function resolveOrganizationForUser(userId: string, role: NonNullable<BetterAuthClaims["role"]>): Promise<AuthOrganization | null> {
  const brokerRole = role === "BROKER_MEMBER" || role === "BROKER_ADMIN";
  if (!brokerRole) return null;

  if (isPrismaPersistence()) {
    const db = getPrismaClient() as unknown as MembershipClient;
    const membership = (await db.brokerUser.findFirst({
      where: { userId, active: true },
      include: {
        organization: { select: { id: true, slug: true, name: true, verificationStatus: true } },
      },
    })) as { organization?: { id: string; slug: string; name: string; verificationStatus: string } } | null;
    if (!membership?.organization) return null;
    const org = membership.organization;
    return {
      id: org.id,
      slug: org.slug,
      name: org.name,
      verificationStatus: org.verificationStatus as AuthOrganization["verificationStatus"],
    };
  }

  /* Fixture mode: dev/test only. Never in production — see the module doc. */
  if (process.env.NODE_ENV === "production") return null;
  return DEMO_BROKER_ORGANIZATION;
}

function isAuthRole(value?: string | null): value is NonNullable<BetterAuthClaims["role"]> {
  return value === "BUYER" || value === "BROKER_MEMBER" || value === "BROKER_ADMIN" || value === "MODERATOR" || value === "ADMIN";
}

/** Test hook: drop the singleton so a test can build an instance against fresh env. */
export function resetAuthServerForTests(): void {
  instance = undefined;
}
