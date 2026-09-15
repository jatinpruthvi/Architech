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
 *
 * Now supports BOTH email (legacy) and phone (India-only +91) as identifier.
 * New flow is phone-based: phone + password for login, phone + OTP + password for signup.
 */

import { normalizeListerType, type ListerType } from "@/lib/listing/lister-type";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 254;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;
export const PHONE_MAX_LENGTH = 20;
export const OTP_LENGTH = 6;

/* Deliberately conservative rather than RFC-5322-complete: a regex that accepts
   every legal address also accepts a great many strings that are typos, and the
   authoritative check is the provider's own. This catches "no @", "no dot",
   whitespace, and doubled dots — the mistakes people actually make. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

// India mobile: 10 digits, first 6-9, and E164 +91
const INDIA_MOBILE_10 = /^[6-9]\d{9}$/;
const E164_INDIA = /^\+91[6-9]\d{9}$/;

export type CredentialField = "email" | "password" | "name" | "listerType" | "phone" | "otp";

export type CredentialIssue = { field: CredentialField; message: string };

export type SignInCredentials = { email: string; password: string };
export type PhoneSignInCredentials = { phone: string; phoneE164: string; password: string };
/* `listerType` is a self-declaration used to default the listing form. It is
   deliberately NOT a role: see lib/listing/lister-type.ts. */
export type SignUpCredentials = SignInCredentials & { name: string; listerType: ListerType };
export type PhoneSignUpCredentials = { name: string; phone: string; phoneE164: string; password: string; listerType: ListerType };

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhoneToE164(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (E164_INDIA.test(trimmed)) return trimmed;
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91") && INDIA_MOBILE_10.test(digitsOnly.slice(2))) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0") && INDIA_MOBILE_10.test(digitsOnly.slice(1))) {
    return `+91${digitsOnly.slice(1)}`;
  }
  if (digitsOnly.length === 10 && INDIA_MOBILE_10.test(digitsOnly)) {
    return `+91${digitsOnly}`;
  }
  return null;
}

export function phoneToSyntheticEmail(phoneE164: string): string {
  // Better Auth requires email format, so we map +91XXXXXXXXXX -> 91XXXXXXXXXX@phone.architech.internal
  const digits = phoneE164.replace(/\D/g, ""); // 91XXXXXXXXXX
  return `${digits}@phone.architech.internal`;
}

export function syntheticEmailToPhone(synthetic: string): string | null {
  const match = synthetic.match(/^(\d{12})@phone\.architech\.internal$/);
  if (!match) return null;
  return `+${match[1]}`;
}

export function validateEmail(value: string): CredentialIssue | null {
  const email = normalizeEmail(value);
  if (!email) return { field: "email", message: "Enter your email address." };
  if (email.length > EMAIL_MAX_LENGTH) return { field: "email", message: "That email address is too long." };
  if (!EMAIL_PATTERN.test(email)) return { field: "email", message: "Enter a valid email address, like you@example.com." };
  return null;
}

export function validatePhone(value: string): CredentialIssue | null {
  const trimmed = value.trim();
  if (!trimmed) return { field: "phone", message: "Enter your mobile number." };
  const e164 = normalizePhoneToE164(trimmed);
  if (!e164) return { field: "phone", message: "Enter a valid 10-digit Indian mobile number starting with 6-9." };
  if (e164.length > PHONE_MAX_LENGTH) return { field: "phone", message: "That phone number is too long." };
  return null;
}

export function validateOtp(value: string): CredentialIssue | null {
  if (!value || !value.trim()) return { field: "otp", message: "Enter the 6-digit OTP." };
  const digits = value.trim().replace(/\D/g, "");
  if (digits.length !== 6) return { field: "otp", message: "OTP must be 6 digits." };
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

/** Validate a sign-in payload (legacy email). */
export function validateSignIn(input: Partial<SignInCredentials>): { ok: true; value: SignInCredentials } | { ok: false; issues: CredentialIssue[] } {
  const email = typeof input.email === "string" ? input.email : "";
  const password = typeof input.password === "string" ? input.password : "";
  const issues = [validateEmail(email), validatePassword(password)].filter((issue): issue is CredentialIssue => issue !== null);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { email: normalizeEmail(email), password } };
}

/** Validate phone sign-in payload (new primary). */
export function validatePhoneSignIn(input: Partial<{ phone: string; password: string }>): { ok: true; value: PhoneSignInCredentials } | { ok: false; issues: CredentialIssue[] } {
  const phone = typeof input.phone === "string" ? input.phone : "";
  const password = typeof input.password === "string" ? input.password : "";
  const phoneIssue = validatePhone(phone);
  const passIssue = validatePassword(password);
  const issues = [phoneIssue, passIssue].filter((i): i is CredentialIssue => i !== null);
  if (issues.length > 0) return { ok: false, issues };
  const e164 = normalizePhoneToE164(phone)!;
  return { ok: true, value: { phone: phone.trim(), phoneE164: e164, password } };
}

export function validateListerType(value: unknown): CredentialIssue | null {
  return normalizeListerType(value) ? null : { field: "listerType", message: "Tell us whether you are an owner or a broker." };
}

/** Validate a sign-up payload (legacy email). */
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

/** Validate phone sign-up payload (new primary). */
export function validatePhoneSignUp(input: Partial<{ name: string; phone: string; password: string; listerType?: unknown }>): { ok: true; value: PhoneSignUpCredentials } | { ok: false; issues: CredentialIssue[] } {
  const name = typeof input.name === "string" ? input.name : "";
  const phone = typeof input.phone === "string" ? input.phone : "";
  const password = typeof input.password === "string" ? input.password : "";
  const phoneBase = validatePhoneSignIn({ phone, password });
  const nameIssue = validateName(name);
  const listerIssue = validateListerType(input.listerType);
  const extra = [nameIssue, listerIssue].filter((issue): issue is CredentialIssue => issue !== null);
  if (!phoneBase.ok) return { ok: false, issues: [...extra, ...phoneBase.issues] };
  if (extra.length > 0) return { ok: false, issues: extra };
  return {
    ok: true,
    value: {
      name: name.trim(),
      phone: phoneBase.value.phone,
      phoneE164: phoneBase.value.phoneE164,
      password: phoneBase.value.password,
      listerType: normalizeListerType(input.listerType)!,
    },
  };
}

export function validatePhoneAndOtp(input: Partial<{ phone: string; otp: string }>): { ok: true; value: { phone: string; phoneE164: string; otp: string } } | { ok: false; issues: CredentialIssue[] } {
  const phone = typeof input.phone === "string" ? input.phone : "";
  const otp = typeof input.otp === "string" ? input.otp : "";
  const phoneIssue = validatePhone(phone);
  const otpIssue = validateOtp(otp);
  const issues = [phoneIssue, otpIssue].filter((i): i is CredentialIssue => i !== null);
  if (issues.length > 0) return { ok: false, issues };
  const e164 = normalizePhoneToE164(phone)!;
  const digits = otp.trim().replace(/\D/g, "");
  return { ok: true, value: { phone: phone.trim(), phoneE164: e164, otp: digits } };
}

/* Sign-in failure is reported as ONE message for both "unknown email" and
   "wrong password". Distinguishing them turns the form into an account
   enumeration oracle, which is exactly how credential-stuffing lists get
   validated before they are used. */
export const INVALID_CREDENTIALS_MESSAGE = "That email and password combination did not match an account.";
export const INVALID_PHONE_CREDENTIALS_MESSAGE = "That mobile number and password combination did not match an account.";
