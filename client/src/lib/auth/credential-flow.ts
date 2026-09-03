/* Server-side credential flow (server-only).
 *
 * Sits between the login/register/logout routes and Better Auth. The routes
 * stay thin; this module owns the parts that must not be duplicated or skipped:
 * validation, throttling, provider dispatch, cookie propagation, and the
 * uniform failure message.
 *
 * Dispatch goes through `auth.handler(Request)` rather than the typed
 * `auth.api.*` helpers for one concrete reason: the handler returns the real
 * `Set-Cookie` headers Better Auth minted, and those cookies are the session.
 * Reconstructing them by hand is how a login endpoint ends up "succeeding"
 * while the browser never receives a session.
 *
 * The provider is only consulted in live mode. In `demo` mode the deployment
 * has no user store at all, so credentials are checked against the demo
 * roster in `demo-accounts.ts` — that keeps the login page a real, working
 * flow in previews and CI without pretending a database exists.
 */
import "server-only";
import { getAuthServer } from "./server-auth";
import { getSessionContractForRequest } from "./live";
import { getAuthSourceMode } from "./source";
import { BETTER_AUTH_SESSION_COOKIE } from "./live-session";
import { INVALID_CREDENTIALS_MESSAGE, validateSignIn, validateSignUp, type CredentialIssue } from "./credentials";
import { clearLoginAttempts, registerLoginAttempt } from "./login-throttle";
import { clientKey } from "./request-safety";
import { authenticateDemoAccount, demoSessionCookieValue, demoSignOutCookieValue, sessionForDemoCookie } from "./demo-accounts";
import type { AuthSession } from "./roles";

export type CredentialResult =
  | { ok: true; session: AuthSession; cookies: string[] }
  | { ok: false; status: number; code: string; issues: CredentialIssue[]; message: string; retryAfterSeconds?: number };

function failure(status: number, code: string, message: string, issues: CredentialIssue[] = [], retryAfterSeconds?: number): CredentialResult {
  return { ok: false, status, code, message, issues, retryAfterSeconds };
}

/** Forward a credential payload to Better Auth and collect cookies + session.
 *
 *  The caller's `Cookie` header is forwarded because some endpoints act on the
 *  CURRENT session rather than on the body: `sign-out` in particular needs the
 *  session token to know which session to revoke. Without it the handler
 *  cheerfully returns cookie-clearing headers while leaving the session valid
 *  server-side — the browser looks signed out, but a copy of the token still
 *  authenticates. Sign-in/sign-up ignore the header, so forwarding it is safe
 *  for every path. */
async function callProvider(path: string, body: Record<string, unknown>, request: Request): Promise<{ status: number; cookies: string[]; payload: Record<string, unknown> }> {
  const auth = getAuthServer();
  const origin = new URL(request.url).origin;
  const headers: Record<string, string> = { "content-type": "application/json" };
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  const response = await auth.handler(
    new Request(`${origin}/api/auth/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
  const cookies = response.headers.getSetCookie();
  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    /* Better Auth returns an empty body on some failures; the status carries it. */
  }
  return { status: response.status, cookies, payload };
}

/** Re-resolve the session contract using the cookies just minted, so the caller
    gets the SAME shape every other surface reads (role, org, permissions). */
async function sessionFromMintedCookies(request: Request, cookies: string[]): Promise<AuthSession | null> {
  const cookieHeader = cookies.map((cookie) => cookie.split(";")[0]).join("; ");
  if (!cookieHeader) return null;
  const url = new URL(request.url);
  const probe = new Request(`${url.origin}/api/auth/session?source=better-auth`, { headers: { cookie: cookieHeader } });
  const contract = await getSessionContractForRequest(probe);
  return contract.session;
}

export async function signInWithCredentials(request: Request, input: Partial<{ email: string; password: string }>): Promise<CredentialResult> {
  const validated = validateSignIn(input);
  if (!validated.ok) return failure(400, "INVALID_CREDENTIALS_INPUT", "Check the highlighted fields.", validated.issues);
  const { email, password } = validated.value;

  const throttle = registerLoginAttempt({ ip: clientKey(request), email });
  if (!throttle.allowed) {
    return failure(429, "TOO_MANY_ATTEMPTS", "Too many sign-in attempts. Please wait before trying again.", [], throttle.retryAfterSeconds);
  }

  if (getAuthSourceMode() === "demo") {
    const account = authenticateDemoAccount(email, password);
    if (!account) return failure(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
    clearLoginAttempts(email);
    return { ok: true, session: account.session, cookies: [demoSessionCookieValue(account, request)] };
  }

  const provider = await callProvider("sign-in/email", { email, password }, request);
  if (provider.status !== 200 || provider.cookies.length === 0) {
    return failure(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  const session = await sessionFromMintedCookies(request, provider.cookies);
  if (!session) return failure(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  clearLoginAttempts(email);
  return { ok: true, session, cookies: provider.cookies };
}

export async function registerWithCredentials(request: Request, input: Partial<{ email: string; password: string; name: string; listerType: string }>): Promise<CredentialResult> {
  const validated = validateSignUp(input);
  if (!validated.ok) return failure(400, "INVALID_CREDENTIALS_INPUT", "Check the highlighted fields.", validated.issues);
  const { email, password, name, listerType } = validated.value;

  if (getAuthSourceMode() === "demo") {
    /* Registration writes to a user store. Demo mode has none, so it refuses
       explicitly rather than appearing to create an account that vanishes. */
    return failure(503, "REGISTRATION_UNAVAILABLE", "Account creation is disabled in this preview. Use one of the demo sign-ins below.");
  }

  /* Role is NOT accepted from the request. A self-service sign-up that could
     name its own role would let anyone mint a BROKER_ADMIN; elevation happens
     through broker onboarding and an organization membership row.

     `listerType` IS accepted, and the difference is the whole point: it records
     what the person said they are so the listing form can default its
     attribution checkbox, while `role` — the thing that actually authorises —
     stays BUYER until onboarding grants a membership. Declaring "broker" here
     buys exactly one pre-ticked checkbox, not a single permission. */
  const provider = await callProvider("sign-up/email", { email, password, name, role: "BUYER", listerType }, request);
  if (provider.status !== 200 || provider.cookies.length === 0) {
    const message = typeof provider.payload.message === "string" ? provider.payload.message : "We could not create that account.";
    const alreadyExists = provider.status === 422 || /exist/i.test(message);
    return failure(alreadyExists ? 409 : 400, alreadyExists ? "ACCOUNT_EXISTS" : "REGISTRATION_FAILED", alreadyExists ? "An account already exists for that email address." : message, alreadyExists ? [{ field: "email", message: "An account already exists for that email address." }] : []);
  }

  const session = await sessionFromMintedCookies(request, provider.cookies);
  if (!session) return failure(400, "REGISTRATION_FAILED", "We could not create that account.");
  return { ok: true, session, cookies: provider.cookies };
}

/** Cookie strings that clear the session on the client. */
export async function signOutCookies(request: Request): Promise<string[]> {
  const secure = new URL(request.url).protocol === "https:";
  /* Demo mode writes the explicit signed-out sentinel: deleting the cookie
     would fall back to the "absent ⇒ demo broker session" contract and sign
     the user straight back in. See demo-accounts.ts. */
  if (getAuthSourceMode() === "demo") return [demoSignOutCookieValue(request)];

  const provider = await callProvider("sign-out", {}, request);
  const cleared = `${BETTER_AUTH_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  return provider.cookies.length > 0 ? provider.cookies : [cleared];
}

export { sessionForDemoCookie };
