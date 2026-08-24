import { demoBrokerSession, type AuthOrganization, type AuthRole, type AuthSession } from "./roles";
import { getAuthSourceMode, validateBetterAuthEnvironment } from "./source";

export type BetterAuthClaims = {
  userId: string;
  name?: string | null;
  email: string;
  role?: AuthRole | null;
  organization?: AuthOrganization | null;
  permissions?: string[] | null;
};

export function mapBetterAuthClaimsToSession(claims: BetterAuthClaims): AuthSession {
  return {
    user: {
      id: claims.userId,
      name: claims.name || claims.email,
      email: claims.email,
      role: claims.role ?? "BUYER",
    },
    organization: claims.organization ?? undefined,
    permissions: claims.permissions ?? [],
    source: "better-auth-live",
  };
}

export function getAuthReadiness(source = getAuthSourceMode()) {
  if (source === "demo") return { ready: true, source, missing: [] as string[] };
  const env = validateBetterAuthEnvironment();
  return { ready: env.ok, source, missing: env.missing };
}

export async function getSessionContractForRequest(request: Request): Promise<{ session: AuthSession | null; source: AuthSession["source"] | "better-auth-not-configured"; missing: string[] }> {
  const url = new URL(request.url);
  if (url.searchParams.get("mode") === "none") return { session: null, source: "better-auth-contract-demo", missing: [] };

  const source = url.searchParams.get("source") === "better-auth" ? "better-auth" : getAuthSourceMode();
  if (source === "demo") return { session: demoBrokerSession, source: demoBrokerSession.source, missing: [] };

  const readiness = getAuthReadiness("better-auth");
  if (!readiness.ready) return { session: null, source: "better-auth-not-configured", missing: readiness.missing };

  // Live Better Auth session retrieval is intentionally isolated behind this
  // contract until platform cookies, DB adapter and production secrets are wired.
  // The returned shape is stable for broker routes and tests.
  return { session: null, source: "better-auth-live", missing: [] };
}
