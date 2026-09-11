import "server-only";
import { mapBetterAuthClaimsToSession, type BetterAuthClaims } from "./live";
import { validateBetterAuthEnvironment } from "./source";
import type { AuthSession } from "./roles";

/* Live Better Auth session adapter (server-only).
   Resolves a session from the request cookie envelope via Better Auth, then
   maps it to the stable Architech session shape. The actual Better Auth call is
   isolated behind an injectable `resolveClaims` so the adapter is unit-testable
   and no provider SDK leaks into the client bundle. */

/** Session cookie name used by Better Auth for the current deployment. */
export const BETTER_AUTH_SESSION_COOKIE = "better-auth.session_token";

export type SessionResolution =
  | { ok: true; session: AuthSession; source: "better-auth-live" }
  | { ok: false; source: "better-auth-not-configured" | "no-session-cookie" | "invalid-session"; missing?: string[] };

export async function resolveLiveSession(
  request: Request,
  deps: {
    resolveClaims?: (token: string) => Promise<BetterAuthClaims | null>;
    env?: Partial<Record<"BETTER_AUTH_SECRET" | "BETTER_AUTH_URL" | "DATABASE_URL" | "ARCHITECH_AUTH_SOURCE", string>>;
  } = {},
): Promise<SessionResolution> {
  const env = (deps.env ?? process.env) as Partial<Record<"BETTER_AUTH_SECRET" | "BETTER_AUTH_URL" | "DATABASE_URL" | "ARCHITECH_AUTH_SOURCE", string>>;
  const authSource = env.ARCHITECH_AUTH_SOURCE ?? "";
  if (authSource !== "better-auth") {
    return { ok: false, source: "better-auth-not-configured", missing: undefined };
  }

  const readiness = validateBetterAuthEnvironment(env);
  if (!readiness.ok) return { ok: false, source: "better-auth-not-configured", missing: readiness.missing };

  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = parseSessionCookie(cookieHeader);
  if (!token) return { ok: false, source: "no-session-cookie" };

  const resolveClaims = deps.resolveClaims;
  if (!resolveClaims) return { ok: false, source: "invalid-session" };

  const claims = await resolveClaims(token);
  if (!claims) return { ok: false, source: "invalid-session" };

  return { ok: true, session: mapBetterAuthClaimsToSession(claims), source: "better-auth-live" };
}

/** Parse a single desired session token out of the cookie header (no manual cookie SDK). */
export function parseSessionCookie(cookieHeader: string): string | undefined {
  const pairs = cookieHeader.split("; ").map((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) return { name: part, value: "" };
    return { name: part.slice(0, idx), value: decodeURIComponent(part.slice(idx + 1)) };
  });
  return pairs.find((pair) => pair.name === BETTER_AUTH_SESSION_COOKIE)?.value || undefined;
}
