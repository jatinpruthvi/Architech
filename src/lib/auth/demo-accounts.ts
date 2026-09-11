/* Demo credential roster for `ARCHITECH_AUTH_SOURCE=demo`.
 *
 * Why this exists: demo mode has no user store, so before this slice the login
 * page would have had nothing to sign in against and every visitor was already
 * a BROKER_ADMIN. That makes the login flow untestable in previews and CI —
 * exactly where it most needs exercising.
 *
 * A named roster gives the flow something real to do: a password is checked, a
 * cookie is set, the header reflects it, sign-out clears it, and role-gated
 * routing can be observed for a buyer, a broker and a moderator.
 *
 * SECURITY NOTE — this is NOT an authentication mechanism.
 * The cookie carries an account id in plaintext and is not signed, so anyone
 * can name any demo role. That is acceptable ONLY because:
 *   - demo mode already granted every visitor the broker session by default,
 *     so nothing is escalated that was not already open; and
 *   - `authorizeRequest()` rejects any `better-auth-contract-demo` session
 *     outright when `NODE_ENV === "production"`, so a demo cookie can never
 *     authorise a mutation on a real deployment.
 * Production runs `ARCHITECH_AUTH_SOURCE=better-auth`, where this module is
 * never consulted (see `credential-flow.ts`).
 */
import { demoBrokerSession, permissionsForRole, type AuthOrganization, type AuthRole, type AuthSession } from "./roles";
import type { ListerType } from "@/lib/listing/lister-type";

/** Cookie that records which demo account is signed in. */
export const DEMO_SESSION_COOKIE = "architech.demo_session";
/** Sentinel written by sign-out so demo mode can represent "signed out" at all. */
export const DEMO_SIGNED_OUT = "signed-out";

const DEMO_ORGANIZATION: AuthOrganization = demoBrokerSession.organization ?? {
  id: "demo-org-nivasa-partners",
  slug: "nivasa-partners",
  name: "Nivasa Partners",
  verificationStatus: "VERIFIED_PARTNER",
};

export type DemoAccount = {
  id: string;
  label: string;
  email: string;
  password: string;
  session: AuthSession;
};

function demoSession(id: string, name: string, email: string, role: AuthRole, organization?: AuthOrganization, listerType: ListerType = "OWNER"): AuthSession {
  return {
    user: { id, name, email, role, listerType },
    organization,
    permissions: role === "BROKER_ADMIN" ? demoBrokerSession.permissions : permissionsForRole(role),
    source: "better-auth-contract-demo",
  };
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "demo-user-broker-admin",
    label: "Broker admin",
    email: demoBrokerSession.user.email,
    password: "demo-broker-1234",
    session: demoBrokerSession,
  },
  {
    id: "demo-user-buyer",
    label: "Buyer",
    email: "buyer@example.com",
    password: "demo-buyer-1234",
    session: demoSession("demo-user-buyer", "Demo Buyer", "buyer@example.com", "BUYER"),
  },
  {
    id: "demo-user-moderator",
    label: "Moderator",
    email: "moderator@example.com",
    password: "demo-moderator-1234",
    session: demoSession("demo-user-moderator", "Demo Moderator", "moderator@example.com", "MODERATOR"),
  },
  {
    id: "demo-user-broker-member",
    label: "Broker member",
    email: "broker-member@example.com",
    password: "demo-member-1234",
    session: demoSession("demo-user-broker-member", "Demo Broker Member", "broker-member@example.com", "BROKER_MEMBER", DEMO_ORGANIZATION, "BROKER"),
  },
];

/* Constant-time-ish comparison. The demo passwords are published in this very
   file, so this buys nothing against an attacker — it exists so the shape of
   the code does not teach the wrong habit to whoever ports it to live mode. */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function authenticateDemoAccount(email: string, password: string): DemoAccount | null {
  const account = DEMO_ACCOUNTS.find((candidate) => candidate.email === email.trim().toLowerCase());
  if (!account) return null;
  return equals(account.password, password) ? account : null;
}

export function findDemoAccountById(id: string): DemoAccount | null {
  return DEMO_ACCOUNTS.find((account) => account.id === id) ?? null;
}

/** The `Set-Cookie` value that signs a demo account in. */
export function demoSessionCookieValue(account: DemoAccount, request: Request): string {
  const secure = new URL(request.url).protocol === "https:";
  return `${DEMO_SESSION_COOKIE}=${encodeURIComponent(account.id)}; Path=/; Max-Age=${60 * 60 * 8}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** The `Set-Cookie` value that signs a demo account out. */
export function demoSignOutCookieValue(request: Request): string {
  const secure = new URL(request.url).protocol === "https:";
  return `${DEMO_SESSION_COOKIE}=${DEMO_SIGNED_OUT}; Path=/; Max-Age=${60 * 60 * 8}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function readCookie(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    if (trimmed.slice(0, index) === name) return decodeURIComponent(trimmed.slice(index + 1));
  }
  return undefined;
}

export type DemoCookieState =
  | { kind: "absent" }
  | { kind: "signed-out" }
  | { kind: "account"; session: AuthSession };

/** Interpret the demo cookie on a request.
 *
 *  `absent` deliberately does NOT mean "signed out": the pre-existing demo
 *  contract is that a request with no cookie sees the broker session, and
 *  broker dashboards, moderation fixtures and their tests are built on it.
 *  Sign-out therefore writes an explicit sentinel instead of deleting the
 *  cookie — otherwise "log out" would silently log you back in. */
export function sessionForDemoCookie(cookieHeader: string): DemoCookieState {
  const value = readCookie(cookieHeader, DEMO_SESSION_COOKIE);
  if (!value) return { kind: "absent" };
  if (value === DEMO_SIGNED_OUT) return { kind: "signed-out" };
  const account = findDemoAccountById(value);
  return account ? { kind: "account", session: account.session } : { kind: "absent" };
}
