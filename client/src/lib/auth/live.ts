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
  if (source === "demo") {
    /* Demo mode is no longer "everyone is the broker admin unconditionally":
       the login page can sign a specific demo account in, and sign-out must
       actually sign out. The cookie decides; with no cookie the historical
       default (broker admin) is preserved so existing broker/moderation
       fixtures and their tests keep passing. */
    const { sessionForDemoCookie } = await import("./demo-accounts");
    const state = sessionForDemoCookie(request.headers.get("cookie") ?? "");
    if (state.kind === "signed-out") return { session: null, source: "better-auth-contract-demo", missing: [] };
    const session = state.kind === "account" ? state.session : demoBrokerSession;
    return { session, source: session.source, missing: [] };
  }

  const readiness = getAuthReadiness("better-auth");
  if (!readiness.ready) return { session: null, source: "better-auth-not-configured", missing: readiness.missing };

  /* Live Better Auth session retrieval. `live-session.ts` owns the
     cookie → token → claims resolution; this module provides the Better Auth
     claims resolver and maps the result into the stable session contract.
     (Dynamic import keeps `live-session`'s dependency on `./live` acyclic.) */
  const { resolveLiveSession } = await import("./live-session");
  const { resolveBetterAuthClaims } = await import("./server-auth");
  const resolution = await resolveLiveSession(request, { resolveClaims: resolveBetterAuthClaims });
  if (resolution.ok) return { session: resolution.session, source: resolution.source, missing: [] };
  if (resolution.source === "better-auth-not-configured") return { session: null, source: resolution.source, missing: resolution.missing ?? [] };
  // A configured deployment with no/invalid cookie is a 401, not a 503.
  return { session: null, source: "better-auth-live", missing: [] };
}
