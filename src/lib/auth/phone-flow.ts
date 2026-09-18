/* Phone-based credential flow – server-only.
 * Handles phone OTP verification + phone/password login/registration.
 * Reuses Better Auth via synthetic email pattern: +91XXXXXXXXXX -> 91XXXXXXXXXX@phone.architech.internal
 * Matches existing credential-flow pattern for cookie handling, throttling, etc.
 */

import "server-only";
import { getAuthServer } from "./server-auth";
import { getSessionContractForRequest } from "./live";
import { getAuthSourceMode } from "./source";
import { INVALID_PHONE_CREDENTIALS_MESSAGE, validatePhoneSignIn, validatePhoneSignUp, phoneToSyntheticEmail, type CredentialIssue } from "./credentials";
import { clearLoginAttempts, registerLoginAttempt } from "./login-throttle";
import { clientKey } from "./request-safety";
import { permissionsForRole, type AuthSession } from "./roles";
import { demoResetPasswordFor } from "./password-reset-flow";
import { getLatestValidOtp, incrementAttempts, markVerified, countRecentOtps, createOtpRecord, invalidateOtpsForPhone } from "./otp-store";
import { generateOtp, hashOtp, verifyOtpHash, otpExpiryDate, isOtpExpired, OTP_PURPOSE_SIGNUP } from "./otp";
import { sendAuthOtpViaWhatsApp } from "./whatsapp-otp";
import { maskPhone } from "./phone";

export type PhoneCredentialResult =
  | { ok: true; session: AuthSession; cookies: string[] }
  | { ok: false; status: number; code: string; issues: CredentialIssue[]; message: string; retryAfterSeconds?: number };

function failure(status: number, code: string, message: string, issues: CredentialIssue[] = [], retryAfterSeconds?: number): PhoneCredentialResult {
  return { ok: false, status, code, message, issues, retryAfterSeconds };
}

function configuredOrigin(): string | null {
  for (const candidate of [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    if (!candidate) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      /* An unparseable configured origin must not become a wildcard — skip it
         and try the next candidate. */
    }
  }
  return null;
}

async function callProvider(path: string, body: Record<string, unknown>, request: Request): Promise<{ status: number; cookies: string[]; payload: Record<string, unknown> }> {
  const auth = getAuthServer();
  const origin = new URL(request.url).origin;
  const headers: Record<string, string> = { "content-type": "application/json" };
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  for (const header of ["x-real-ip", "cf-connecting-ip"]) {
    const value = request.headers.get(header);
    if (value) headers[header] = value;
  }
  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) headers["x-forwarded-for"] = forwarded;
  }
  headers.origin = configuredOrigin() ?? origin;
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
    /* A non-JSON body leaves `payload` empty rather than failing the call:
       the status code is what decides success, and the payload is only read
       for an error message. */
  }
  return { status: response.status, cookies, payload };
}

async function sessionFromMintedCookies(request: Request, cookies: string[]): Promise<AuthSession | null> {
  const cookieHeader = cookies.map((cookie) => cookie.split(";")[0]).join("; ");
  if (!cookieHeader) return null;
  const url = new URL(request.url);
  const probe = new Request(`${url.origin}/api/auth/session?source=better-auth`, { headers: { cookie: cookieHeader } });
  const contract = await getSessionContractForRequest(probe);
  return contract.session;
}

/* Sign-in with phone + password */
export async function signInWithPhone(request: Request, input: Partial<{ phone: string; password: string }>): Promise<PhoneCredentialResult> {
  const validated = validatePhoneSignIn(input);
  if (!validated.ok) return failure(400, "INVALID_CREDENTIALS_INPUT", "Check the highlighted fields.", validated.issues);
  const { phoneE164, password } = validated.value;

  const throttle = registerLoginAttempt({ ip: clientKey(request), email: phoneE164 }); // use phone as key
  if (!throttle.allowed) {
    return failure(429, "TOO_MANY_ATTEMPTS", "Too many sign-in attempts. Please wait before trying again.", [], throttle.retryAfterSeconds);
  }

  if (getAuthSourceMode() === "demo") {
    const { authenticateDemoPhoneAccount, demoSessionCookieValue, DEMO_ACCOUNTS } = await import("./demo-accounts");
    /* A demo-mode forgot-password has nowhere to write a hash (there is no user
       store), so `password-reset-flow.ts` parks the new password per phone and
       it is honoured here. Without this the reset form would report success and
       the very next sign-in would reject the password it had just set — a bug
       that survives review because the reset's own happy path looks green.

       Once a number has a reset password it is the ONLY accepted one: leaving
       a published demo password working too would mean "change your password"
       did not actually change what signs you in. */
    const resetPassword = demoResetPasswordFor(phoneE164);
    const publishedAccount = resetPassword === null ? authenticateDemoPhoneAccount(phoneE164, password) : null;
    if (publishedAccount) {
      clearLoginAttempts(phoneE164);
      return {
        ok: true,
        session: publishedAccount.session,
        cookies: [demoSessionCookieValue(publishedAccount, request)],
      };
    }

    // Unlisted demo numbers remain buyer-shaped for registration/reset previews.
    const buyer = DEMO_ACCOUNTS.find((a) => a.id === "demo-user-buyer");
    const accepted = resetPassword !== null ? password === resetPassword : buyer !== undefined && password === buyer.password;
    if (accepted) {
      const mockSession = {
        user: {
          id: `demo-phone-${phoneE164}`,
          name: resetPassword !== null ? `Phone User ${phoneE164.slice(-4)}` : buyer!.session.user.name,
          email: phoneToSyntheticEmail(phoneE164),
          role: "BUYER" as const,
          listerType: "OWNER" as const,
          phoneE164,
        },
        permissions: resetPassword !== null ? permissionsForRole("BUYER") : buyer!.session.permissions,
        source: "better-auth-contract-demo" as const,
      };
      // Create cookie with phone id so sessionForDemoCookie can restore it
      const secure = new URL(request.url).protocol === "https:";
      const cookie = `architech.demo_session=${encodeURIComponent(`demo-phone-${phoneE164}`)}; Path=/; Max-Age=${60 * 60 * 8}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
      return { ok: true, session: mockSession as any, cookies: [cookie] };
    }
    return failure(401, "INVALID_CREDENTIALS", INVALID_PHONE_CREDENTIALS_MESSAGE);
  }

  const syntheticEmail = phoneToSyntheticEmail(phoneE164);
  const provider = await callProvider("sign-in/email", { email: syntheticEmail, password }, request);
  if (provider.status === 429) {
    return failure(429, "TOO_MANY_ATTEMPTS", "Too many sign-in attempts. Please wait before trying again.");
  }
  if (provider.status !== 200 || provider.cookies.length === 0) {
    return failure(401, "INVALID_CREDENTIALS", INVALID_PHONE_CREDENTIALS_MESSAGE);
  }
  const session = await sessionFromMintedCookies(request, provider.cookies);
  if (!session) return failure(401, "INVALID_CREDENTIALS", INVALID_PHONE_CREDENTIALS_MESSAGE);
  clearLoginAttempts(phoneE164);
  return { ok: true, session, cookies: provider.cookies };
}

/* Send OTP for signup */
export async function sendSignupOtp(request: Request, input: Partial<{ phone: string; name: string; password: string; listerType: string }>): Promise<{ ok: true; phoneE164: string; phoneMasked: string; expiresAt: string } | { ok: false; status: number; code: string; message: string; issues: CredentialIssue[]; retryAfterSeconds?: number }> {
  const { validatePhoneSignUp } = await import("./credentials");
  const validated = validatePhoneSignUp(input);
  if (!validated.ok) {
    return { ok: false, status: 400, code: "INVALID_INPUT", message: "Check the highlighted fields.", issues: validated.issues };
  }
  const { phoneE164, name, password, listerType } = validated.value;

  // Throttle by phone: 3 per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await countRecentOtps(phoneE164, oneHourAgo, OTP_PURPOSE_SIGNUP);
  if (recentCount >= 3) {
    return { ok: false, status: 429, code: "TOO_MANY_OTPS", message: "Too many OTP requests for this number. Please try again after an hour.", issues: [], retryAfterSeconds: 3600 };
  }

  // Throttle by IP as well (reuse login throttle)
  const throttle = registerLoginAttempt({ ip: clientKey(request), email: phoneE164 });
  if (!throttle.allowed) {
    return { ok: false, status: 429, code: "TOO_MANY_ATTEMPTS", message: "Too many requests. Please wait.", issues: [], retryAfterSeconds: throttle.retryAfterSeconds };
  }

  // Check if user already exists (via Better Auth or Prisma)
  // We check via provider? Simpler: try to see if synthetic email exists by attempting sign-in? Better to check Prisma if available
  // For now, we will attempt to check via Prisma user table if in prisma mode, else skip
  try {
    const { isPrismaPersistence } = await import("@/lib/persistence/source");
    if (isPrismaPersistence()) {
      const { getPrismaClient } = await import("@/lib/repositories/server/prisma");
      const db = getPrismaClient() as any;
      const existing = await db.user.findFirst({ where: { OR: [{ phoneE164 }, { email: phoneToSyntheticEmail(phoneE164) }] } });
      if (existing) {
        return { ok: false, status: 409, code: "ACCOUNT_EXISTS", message: "An account already exists for this mobile number.", issues: [{ field: "phone", message: "An account already exists for this number." }] };
      }
    }
  } catch {
    // Ignore, proceed
  }

  if (getAuthSourceMode() === "demo") {
    // In demo, mock OTP send
    const otp = "123456"; // fixed for demo
    const hash = hashOtp(otp);
    await createOtpRecord({ phoneE164, otpHash: hash, purpose: OTP_PURPOSE_SIGNUP, expiresAt: otpExpiryDate() });
    console.log(`[Demo OTP] ${phoneE164} OTP: ${otp}`);
    return { ok: true, phoneE164, phoneMasked: maskPhone(phoneE164), expiresAt: otpExpiryDate().toISOString() };
  }

  const otp = generateOtp();
  const hash = hashOtp(otp);
  const expiresAt = otpExpiryDate();

  await createOtpRecord({ phoneE164, otpHash: hash, purpose: OTP_PURPOSE_SIGNUP, expiresAt });

  const sendResult = await sendAuthOtpViaWhatsApp(phoneE164, otp);
  if (!sendResult.ok) {
    // If provider disabled in dev, we already mocked in whatsapp-otp.ts and returned ok, so this is real failure
    return { ok: false, status: 502, code: sendResult.reason, message: "We could not send OTP via WhatsApp. Please ensure admin WhatsApp is connected.", issues: [] };
  }

  return { ok: true, phoneE164, phoneMasked: maskPhone(phoneE164), expiresAt: expiresAt.toISOString() };
}

/* Verify OTP and create account */
export async function verifyOtpAndRegister(request: Request, input: Partial<{ phone: string; otp: string; name: string; password: string; listerType: string }>): Promise<PhoneCredentialResult> {
  const { validatePhoneSignUp, validateOtp } = await import("./credentials");
  // Validate OTP separately
  const phone = typeof input.phone === "string" ? input.phone : "";
  const otp = typeof input.otp === "string" ? input.otp : "";
  const otpIssue = validateOtp(otp);
  if (otpIssue) return failure(400, "INVALID_OTP", "Check the OTP.", [otpIssue]);

  const validated = validatePhoneSignUp(input);
  if (!validated.ok) return failure(400, "INVALID_INPUT", "Check the highlighted fields.", validated.issues);

  const { phoneE164, name, password, listerType } = validated.value;
  const digitsOtp = otp.trim().replace(/\D/g, "");
  const syntheticEmail = phoneToSyntheticEmail(phoneE164);

  const record = await getLatestValidOtp(phoneE164, OTP_PURPOSE_SIGNUP);
  if (!record) {
    return failure(400, "OTP_EXPIRED", "OTP expired or not found. Please request a new OTP.", [{ field: "otp", message: "OTP expired. Request a new one." }]);
  }

  if (isOtpExpired(record.expiresAt)) {
    return failure(410, "OTP_EXPIRED", "OTP has expired. Please request a new one.", [{ field: "otp", message: "OTP expired." }]);
  }

  if (record.attempts >= record.maxAttempts) {
    return failure(429, "TOO_MANY_ATTEMPTS", "Too many OTP attempts. Please request a new OTP.", [{ field: "otp", message: "Too many attempts." }]);
  }

  const isValid = verifyOtpHash(digitsOtp, record.otpHash);
  if (!isValid) {
    await incrementAttempts(record.id);
    return failure(401, "INVALID_OTP", "Incorrect OTP. Please try again.", [{ field: "otp", message: "Incorrect OTP." }]);
  }

  // OTP valid, mark verified
  await markVerified(record.id);

  if (getAuthSourceMode() === "demo") {
    // Demo mode: create mock buyer session (like demo-accounts but phone-based)
    const { permissionsForRole } = await import("./roles");
    // Create synthetic demo session for phone user
    const mockSession = {
      user: { id: `demo-phone-${phoneE164}`, name, email: syntheticEmail, role: "BUYER" as const, listerType, phoneE164 },
      permissions: permissionsForRole("BUYER"),
      source: "better-auth-contract-demo" as const,
    };
    // Create cookie with phone id so session persists across refreshes
    const secure = new URL(request.url).protocol === "https:";
    const cookie = `architech.demo_session=${encodeURIComponent(`demo-phone-${phoneE164}`)}; Path=/; Max-Age=${60 * 60 * 8}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
    return { ok: true, session: mockSession as any, cookies: [cookie] };
  }

  // Create account via Better Auth with synthetic email (already defined)

  const provider = await callProvider("sign-up/email", { email: syntheticEmail, password, name, role: "BUYER", listerType, phoneE164, phone: phoneE164, phoneVerified: true }, request);

  if (provider.status === 429) {
    return failure(429, "TOO_MANY_ATTEMPTS", "Too many sign-up attempts. Please wait.", []);
  }
  if (provider.status !== 200 || provider.cookies.length === 0) {
    const message = typeof provider.payload.message === "string" ? provider.payload.message : "We could not create that account.";
    const alreadyExists = provider.status === 422 || /exist/i.test(message);
    if (!alreadyExists) {
      console.error(`[auth] phone sign-up rejected: status=${provider.status} payload=${JSON.stringify(provider.payload)}`);
    }
    return failure(alreadyExists ? 409 : 400, alreadyExists ? "ACCOUNT_EXISTS" : "REGISTRATION_FAILED", alreadyExists ? "An account already exists for this number." : message, alreadyExists ? [{ field: "phone", message: "Account exists." }] : []);
  }

  const session = await sessionFromMintedCookies(request, provider.cookies);
  if (!session) return failure(400, "REGISTRATION_FAILED", "We could not create that account.");

  // Invalidate other OTPs for this phone
  await invalidateOtpsForPhone(phoneE164, OTP_PURPOSE_SIGNUP);

  // Also create Prisma User if in prisma mode? Better Auth memory adapter doesn't create Prisma user, but we should create Prisma User for future
  try {
    const { isPrismaPersistence } = await import("@/lib/persistence/source");
    if (isPrismaPersistence()) {
      const { getPrismaClient } = await import("@/lib/repositories/server/prisma");
      const db = getPrismaClient() as any;
      // Upsert Prisma User with phoneE164
      const existing = await db.user.findFirst({ where: { phoneE164 } });
      if (!existing) {
        await db.user.create({
          data: {
            email: syntheticEmail,
            phoneE164,
            phoneLast4: phoneE164.slice(-4),
            phoneVerified: new Date(),
            name,
            role: "BUYER",
            listerType,
          },
        });
      }
    }
  } catch (e) {
    console.error("[auth] failed to create prisma user after phone signup", e);
    // Don't fail registration, Better Auth user already created
  }

  return { ok: true, session, cookies: provider.cookies };
}
