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
 * ⚠ THE MEMORY ADAPTER IS NOT MERELY "NOT DURABLE ACROSS RESTARTS".
 * `next start` serves from a POOL OF WORKER PROCESSES, and this singleton is
 * per-process, so each worker holds a DIFFERENT set of users and sessions.
 * Measured against a production build: the same correct credentials return 200
 * or 401 depending purely on which worker answered, and a session minted on one
 * worker is unauthenticated on the next request. Live auth is therefore NOT
 * usable in any multi-worker deployment until the Prisma adapter lands —
 * treat `ARCHITECH_AUTH_SOURCE=better-auth` as single-process-only for now.
 * `tests/e2e/auth-flows.mjs` pins this as a known limitation so the day it is
 * fixed, the test tells you.
 *
 * `role` is a user additional field so a live session can carry the role the
 * demo contract already knows; it defaults to BUYER for plain sign-ups. */
import "server-only";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import type { BetterAuthClaims } from "./live";
import { BETTER_AUTH_SESSION_COOKIE } from "./live-session";
import { permissionsForRole, type AuthOrganization } from "./roles";
import { normalizeListerType } from "@/lib/listing/lister-type";
import { isPrismaPersistence } from "@/lib/persistence/source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

type AuthServer = ReturnType<typeof createAuthServer>;

let instance: AuthServer | undefined;

/* Origins Better Auth will accept a credential request from.
 *
 * Better Auth runs its OWN origin check, separate from `request-safety.ts`, and
 * by default trusts only `baseURL`. That default silently breaks sign-up
 * wherever the public host is not exactly `BETTER_AUTH_URL`: a preview
 * deployment, a custom domain, or simply a deployment that never set the
 * variable — all return `INVALID_ORIGIN`, which surfaces to the user as the
 * unhelpful "We could not create that account."
 *
 * `NEXT_PUBLIC_SITE_URL` is the origin this app already treats as first-party
 * everywhere else, so it is trusted here too. Both values are explicit
 * configuration — nothing is inferred from the request — so this widens the
 * allowlist by exactly one known origin and does not weaken the check. */
function trustedOrigins(): string[] {
  const origins = new Set<string>();
  for (const candidate of [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    if (!candidate) continue;
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      /* An unparseable value must not become a wildcard. */
    }
  }
  return [...origins];
}

function createAuthServer() {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me",
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    trustedOrigins: trustedOrigins(),
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    /* Better Auth cannot resolve a client IP behind this app's proxy setup, and
       its fallback is a SINGLE SHARED per-path bucket — so one noisy client
       throttles every user of the deployment (it logs a warning saying exactly
       this). Point it at the same headers `request-safety.ts` already trusts.
       `TRUST_PROXY_HEADERS` gates `x-forwarded-for` for the same reason it does
       there: that header is client-controlled unless a proxy is known to be in
       front, and a spoofable header would let an attacker rotate buckets. */
    advanced: {
      ipAddress: {
        ipAddressHeaders: process.env.TRUST_PROXY_HEADERS === "true"
          ? ["x-real-ip", "cf-connecting-ip", "x-forwarded-for"]
          : ["x-real-ip", "cf-connecting-ip"],
      },
    },
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "BUYER" },
        /* Self-declared owner/broker captured at sign-up. Stored on the user so
           the listing form can default its attribution checkbox. Explicitly NOT
           a permission — see lib/listing/lister-type.ts. */
        listerType: { type: "string", required: false, defaultValue: "OWNER" },
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
  const user = session.user as { id: string; name?: string | null; email: string; role?: string | null; listerType?: string | null };
  const role = isAuthRole(user.role) ? user.role : "BUYER";
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role,
    listerType: normalizeListerType(user.listerType),
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
