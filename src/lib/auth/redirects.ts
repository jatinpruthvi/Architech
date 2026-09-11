/* Post-authentication destination resolution.
 *
 * Two jobs, both security-relevant:
 *
 * 1. `safeNextPath` — a `?next=` parameter is attacker-supplied. Echoing it
 *    into a redirect is the classic open-redirect: a phishing link points at
 *    OUR domain, we bounce the freshly-signed-in user to an attacker page that
 *    looks like us. Only same-site, absolute-path URLs survive. Protocol-relative
 *    (`//evil.com`) and backslash (`/\evil.com`) forms are rejected explicitly
 *    because browsers normalise them to a host, not a path.
 *
 * 2. `landingPathForSession` — where a session belongs when no destination was
 *    requested. Sending a buyer to `/broker/dashboard/` would immediately bounce
 *    them back out, so the landing page follows role, not a single constant.
 */
import { canAccessBrokerDashboard, hasRoleAtLeast, type AuthSession } from "./roles";

/* Signed-in people land on their dashboard, not on a bare shortlist.
   `/saved/` is a list of properties; it shows nothing about the requirements
   someone filed, the searches they saved, or what is waiting on them. */
export const DEFAULT_BUYER_LANDING = "/dashboard/";
/* Brokers land on the same dashboard: it defaults to the broker persona and
   links through to the deeper partner desk at `/broker/dashboard/`. Keeping
   one landing path means a broker who is also buying a home for themselves
   does not need two bookmarks. */
export const BROKER_LANDING = "/dashboard/";
export const MODERATOR_LANDING = "/admin/moderation/listings/";
export const LOGIN_PATH = "/login/";

/** Coerce an untrusted `next` value into a same-site path, or null. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const candidate = value.trim();
  if (!candidate.startsWith("/")) return null;
  // `//host` and `/\host` are host-relative in browsers, not path-relative.
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return null;
  /* Control characters can be used to smuggle a newline (and therefore a second
     header, or a second path) past a naive check. Scanned by code point rather
     than by regex so the intent is explicit and no escape is mis-read. */
  for (let index = 0; index < candidate.length; index += 1) {
    const code = candidate.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return null;
  }
  // A login link that points back at the login page is a redirect loop.
  const pathOnly = candidate.split(/[?#]/)[0];
  if (pathOnly === LOGIN_PATH || pathOnly === "/login") return null;
  return candidate;
}

/** Where a signed-in session should land when no explicit destination exists. */
export function landingPathForSession(session: AuthSession | null | undefined): string {
  if (!session) return LOGIN_PATH;
  if (canAccessBrokerDashboard(session)) return BROKER_LANDING;
  if (hasRoleAtLeast(session.user.role, "MODERATOR")) return MODERATOR_LANDING;
  return DEFAULT_BUYER_LANDING;
}

/** Final destination after a successful sign-in. */
export function resolvePostLoginPath(session: AuthSession | null | undefined, requestedNext?: string | null): string {
  return safeNextPath(requestedNext) ?? landingPathForSession(session);
}

/** Build a login URL that returns the user to where they were blocked. */
export function loginUrlFor(pathname: string): string {
  const next = safeNextPath(pathname);
  return next ? `${LOGIN_PATH}?next=${encodeURIComponent(next)}` : LOGIN_PATH;
}
