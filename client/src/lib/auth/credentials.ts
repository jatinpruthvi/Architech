/* Credential validation for the sign-in / sign-up surface.
 *
 * Pure and dependency-free on purpose: the SAME rules must run in the browser
 * (so a user sees the problem before a round trip) and on the server (so the
 * browser is never the thing enforcing them). Anything that needs `server-only`
 * or Better Auth lives in the route handler, not here.
 *
 * The password floor matches Better Auth's own `emailAndPassword` default
 * (8 characters); raising it here without raising it there would produce a
 * form that rejects passwords the provider would happily accept, which is a
 * confusing failure mode rather than a security gain.
 */

import { normalizeListerType, type ListerType } from "@/lib/listing/lister-type";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 254;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;

/* Deliberately conservative rather than RFC-5322-complete: a regex that accepts
   every legal address also accepts a great many strings that are typos, and the
   authoritative check is the provider's own. This catches "no @", "no dot",
   whitespace, and doubled dots — the mistakes people actually make. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export type CredentialField = "email" | "password" | "name" | "listerType";

export type CredentialIssue = { field: CredentialField; message: string };

export type SignInCredentials = { email: string; password: string };
/* `listerType` is a self-declaration used to default the listing form. It is
   deliberately NOT a role: see lib/listing/lister-type.ts. */
export type SignUpCredentials = SignInCredentials & { name: string; listerType: ListerType };

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): CredentialIssue | null {
  const email = normalizeEmail(value);
  if (!email) return { field: "email", message: "Enter your email address." };
  if (email.length > EMAIL_MAX_LENGTH) return { field: "email", message: "That email address is too long." };
  if (!EMAIL_PATTERN.test(email)) return { field: "email", message: "Enter a valid email address, like you@example.com." };
  return null;
}

export function validatePassword(value: string): CredentialIssue | null {
  if (!value) return { field: "password", message: "Enter your password." };
  if (value.length < PASSWORD_MIN_LENGTH) {
    return { field: "password", message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return { field: "password", message: `Use at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  return null;
}

export function validateName(value: string): CredentialIssue | null {
  const name = value.trim();
  if (name.length < NAME_MIN_LENGTH) return { field: "name", message: "Enter your full name." };
  if (name.length > NAME_MAX_LENGTH) return { field: "name", message: "That name is too long." };
  return null;
}

/** Validate a sign-in payload. Returns the normalized credentials or the issues. */
export function validateSignIn(input: Partial<SignInCredentials>): { ok: true; value: SignInCredentials } | { ok: false; issues: CredentialIssue[] } {
  const email = typeof input.email === "string" ? input.email : "";
  const password = typeof input.password === "string" ? input.password : "";
  const issues = [validateEmail(email), validatePassword(password)].filter((issue): issue is CredentialIssue => issue !== null);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { email: normalizeEmail(email), password } };
}

export function validateListerType(value: unknown): CredentialIssue | null {
  /* Required, with no silent fallback. Defaulting an unrecognised value to
     OWNER would record a declaration the person never made, and this field is
     shown to buyers as listing attribution. */
  return normalizeListerType(value) ? null : { field: "listerType", message: "Tell us whether you are an owner or a broker." };
}

/** Validate a sign-up payload. Returns the normalized credentials or the issues.

    `listerType` is typed loosely because it arrives from a JSON request body:
    accepting only the narrow union here would push the parsing job onto every
    caller, which is exactly how an unvalidated string reaches storage. This
    function is the one place that widens then narrows. */
export function validateSignUp(input: Partial<Omit<SignUpCredentials, "listerType">> & { listerType?: unknown }): { ok: true; value: SignUpCredentials } | { ok: false; issues: CredentialIssue[] } {
  const name = typeof input.name === "string" ? input.name : "";
  const base = validateSignIn(input);
  const nameIssue = validateName(name);
  const listerIssue = validateListerType(input.listerType);
  const extra = [nameIssue, listerIssue].filter((issue): issue is CredentialIssue => issue !== null);
  if (!base.ok) return { ok: false, issues: [...extra, ...base.issues] };
  if (extra.length > 0) return { ok: false, issues: extra };
  return { ok: true, value: { ...base.value, name: name.trim(), listerType: normalizeListerType(input.listerType)! } };
}

/* Sign-in failure is reported as ONE message for both "unknown email" and
   "wrong password". Distinguishing them turns the form into an account
   enumeration oracle, which is exactly how credential-stuffing lists get
   validated before they are used. */
export const INVALID_CREDENTIALS_MESSAGE = "That email and password combination did not match an account.";
