/* Forgot-password flow – server-only.
 *
 * The WhatsApp-OTP counterpart to `phone-flow.ts`. Same building blocks
 * (`otp.ts` for generation/hashing, `otp-store.ts` for records and throttling,
 * `whatsapp-otp.ts` for delivery through the single system account), one
 * different `purpose` so the two flows can never satisfy each other, and one
 * extra step at the end: the verified code is exchanged for a new password
 * through Better Auth, which owns the password store.
 *
 * NON-ENUMERATION IS THE DESIGN, NOT A DETAIL.
 * A forgot-password form is an account-existence oracle unless you are
 * deliberate about it, and "does +91 98765 43210 have an account here" is
 * precisely the question a targeting list wants answered. So:
 *   - `send` returns the SAME 200 body whether or not the number is registered,
 *     and records an OTP either way so the hourly throttle also behaves
 *     identically (a 429 that only ever arrives for real accounts is a tell).
 *   - `verify` answers a correct code with no account behind it using the same
 *     generic failure as a rejected code.
 * The one observable difference is that no WhatsApp message arrives for an
 * unregistered number — which needs control of the handset, and is the same
 * trade-off every OTP-based reset makes.
 */

import "server-only";
import { getAuthSourceMode } from "./source";
import { phoneToSyntheticEmail, validateResetPassword, validateResetRequest, type CredentialIssue } from "./credentials";
import { clearLoginAttempts, registerLoginAttempt } from "./login-throttle";
import { clientKey } from "./request-safety";
import { countRecentOtps, createOtpRecord, getLatestValidOtp, incrementAttempts, invalidateOtpsForPhone, markVerified } from "./otp-store";
import { DEMO_OTP, generateOtp, hashOtp, isOtpExpired, otpExpiryDate, OTP_MAX_PER_HOUR, OTP_PURPOSE_PASSWORD_RESET, verifyOtpHash } from "./otp";
import { sendAuthOtpViaWhatsApp } from "./whatsapp-otp";
import { applyPasswordResetToken, requestPasswordResetToken } from "./server-auth";
import { maskPhone } from "./phone";

export type PasswordResetSendResult =
  | { ok: true; phoneMasked: string; expiresAt: string }
  | { ok: false; status: number; code: string; message: string; issues: CredentialIssue[]; retryAfterSeconds?: number };

export type PasswordResetResult = { ok: true; phoneMasked: string } | { ok: false; status: number; code: string; message: string; issues: CredentialIssue[]; retryAfterSeconds?: number };

/* Demo mode has no user store, so there is nothing to write a new hash into.
 * Without somewhere to put it, "reset your password" would be a form that
 * reports success and changes nothing — the exact shape of bug that survives
 * review because the happy path looks green. Instead the new password is kept
 * here and `signInWithPhone`'s demo branch consults it, so the whole loop
 * (request → OTP → new password → sign in with it) really runs in previews.
 *
 * bounded-state: demo/fixture only, one entry per phone that completes a reset,
 * overwritten on the next reset for that number and cleared by
 * clearDemoResetPasswordsForTests. Never consulted outside demo mode. */
const demoResetPasswords = new Map<string, string>();

/** The password a demo-mode reset last set for this number, if any. */
export function demoResetPasswordFor(phoneE164: string): string | null {
  return demoResetPasswords.get(phoneE164) ?? null;
}

export function clearDemoResetPasswordsForTests(): void {
  demoResetPasswords.clear();
}

/** Does an account exist for this number?
 *
 *  Best-effort by necessity: in Prisma mode the `user` table is authoritative
 *  and answerable, but the Better Auth memory adapter exposes no public
 *  lookup, and demo mode has no store at all. `null` therefore means
 *  "cannot tell", and callers must treat that as "proceed" — refusing to send
 *  on an unknown would break every non-Prisma deployment. */
async function findAccountForPhone(phoneE164: string): Promise<{ id: string } | null | "unknown"> {
  try {
    const { isPrismaPersistence } = await import("@/lib/persistence/source");
    if (!isPrismaPersistence()) return "unknown";
    const { getPrismaClient } = await import("@/lib/repositories/server/prisma");
    const db = getPrismaClient() as unknown as {
      user: { findFirst(args: unknown): Promise<{ id: string } | null> };
    };
    const found = await db.user.findFirst({
      where: { OR: [{ phoneE164 }, { email: phoneToSyntheticEmail(phoneE164) }] },
      select: { id: true },
    });
    return found ? { id: found.id } : null;
  } catch {
    /* A store that cannot be read must not become a hard failure of a flow
       whose whole purpose is regaining access. Fall back to "cannot tell". */
    return "unknown";
  }
}

function sendFailure(status: number, code: string, message: string, issues: CredentialIssue[] = [], retryAfterSeconds?: number): PasswordResetSendResult {
  return { ok: false, status, code, message, issues, retryAfterSeconds };
}

/** Step 1 – send a reset code over WhatsApp. */
export async function sendPasswordResetOtp(request: Request, input: Partial<{ phone: string }>): Promise<PasswordResetSendResult> {
  const validated = validateResetRequest(input);
  if (!validated.ok) {
    return sendFailure(400, "INVALID_INPUT", "Check the highlighted fields.", validated.issues);
  }
  const { phoneE164 } = validated.value;

  /* Same hourly budget as signup, counted on its own purpose so a user who
     burned three signup codes has not also burned their three reset codes. */
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await countRecentOtps(phoneE164, oneHourAgo, OTP_PURPOSE_PASSWORD_RESET);
  if (recentCount >= OTP_MAX_PER_HOUR) {
    return sendFailure(429, "TOO_MANY_OTPS", "Too many reset requests for this number. Please try again in an hour.", [], 3600);
  }

  const throttle = registerLoginAttempt({ ip: clientKey(request), email: phoneE164 });
  if (!throttle.allowed) {
    return sendFailure(429, "TOO_MANY_ATTEMPTS", "Too many requests. Please wait before trying again.", [], throttle.retryAfterSeconds);
  }

  /* Only the newest code may verify. A user who asks twice (message not
     received, tapped again) should not leave two live codes in flight — a code
     that arrived late is one the user has already stopped watching for. The
     throttle counts by creation time, so retiring the old codes does not hand
     back any budget. */
  await invalidateOtpsForPhone(phoneE164, OTP_PURPOSE_PASSWORD_RESET);

  if (getAuthSourceMode() === "demo") {
    /* Fixed code, same as the signup demo path, so previews and CI can drive
       the flow without a WhatsApp sender. Recorded for real: `verify` checks
       the stored hash rather than special-casing the value. */
    await createOtpRecord({ phoneE164, otpHash: hashOtp(DEMO_OTP), purpose: OTP_PURPOSE_PASSWORD_RESET, expiresAt: otpExpiryDate() });
    console.log(`[Demo OTP] password-reset for ${maskPhone(phoneE164)}: ${DEMO_OTP}`);
    return { ok: true, phoneMasked: maskPhone(phoneE164), expiresAt: otpExpiryDate().toISOString() };
  }

  const otp = generateOtp();
  const expiresAt = otpExpiryDate();

  /* Recorded BEFORE the send decision so an unregistered number consumes
     throttle budget exactly like a registered one. */
  await createOtpRecord({ phoneE164, otpHash: hashOtp(otp), purpose: OTP_PURPOSE_PASSWORD_RESET, expiresAt });

  const account = await findAccountForPhone(phoneE164);

  if (account === null) {
    /* Known-absent account: spend nothing on WhatsApp, and say nothing that
       would reveal the absence. */
    return { ok: true, phoneMasked: maskPhone(phoneE164), expiresAt: expiresAt.toISOString() };
  }

  const sendResult = await sendAuthOtpViaWhatsApp(phoneE164, otp, OTP_PURPOSE_PASSWORD_RESET);
  if (!sendResult.ok) {
    return sendFailure(502, sendResult.reason, "We could not send the reset code over WhatsApp. Please try again shortly.", []);
  }

  return { ok: true, phoneMasked: maskPhone(phoneE164), expiresAt: expiresAt.toISOString() };
}

/** Step 2 – exchange a verified code for a new password. */
export async function verifyOtpAndResetPassword(request: Request, input: Partial<{ phone: string; otp: string; password: string }>): Promise<PasswordResetResult> {
  const resetRequest = validateResetRequest(input);
  if (!resetRequest.ok) {
    return { ok: false, status: 400, code: "INVALID_INPUT", message: "Check the highlighted fields.", issues: resetRequest.issues };
  }
  const { phoneE164 } = resetRequest.value;

  const validated = validateResetPassword(input);
  if (!validated.ok) {
    return { ok: false, status: 400, code: "INVALID_INPUT", message: "Check the highlighted fields.", issues: validated.issues };
  }
  const { otp, password } = validated.value;

  /* Per-code attempts alone are not enough: an attacker who can request codes
     for many numbers gets 5 clean guesses per number, which is a wide-open
     brute force across the account space. The shared IP budget bounds the
     total regardless of how many numbers are in play. */
  const throttle = registerLoginAttempt({ ip: clientKey(request), email: phoneE164 });
  if (!throttle.allowed) {
    return {
      ok: false,
      status: 429,
      code: "TOO_MANY_ATTEMPTS",
      message: "Too many attempts. Please wait before trying again.",
      issues: [],
      retryAfterSeconds: throttle.retryAfterSeconds,
    };
  }

  const record = await getLatestValidOtp(phoneE164, OTP_PURPOSE_PASSWORD_RESET);
  if (!record) {
    return {
      ok: false,
      status: 400,
      code: "OTP_EXPIRED",
      message: "That reset code has expired or was never sent. Please request a new one.",
      issues: [{ field: "otp", message: "Code expired. Request a new one." }],
    };
  }

  if (isOtpExpired(record.expiresAt)) {
    return { ok: false, status: 410, code: "OTP_EXPIRED", message: "That reset code has expired. Please request a new one.", issues: [{ field: "otp", message: "Code expired." }] };
  }

  if (record.attempts >= record.maxAttempts) {
    return {
      ok: false,
      status: 429,
      code: "TOO_MANY_ATTEMPTS",
      message: "Too many incorrect codes. Please request a new one.",
      issues: [{ field: "otp", message: "Too many attempts." }],
      retryAfterSeconds: 3600,
    };
  }

  if (!verifyOtpHash(otp, record.otpHash)) {
    await incrementAttempts(record.id);
    return { ok: false, status: 401, code: "INVALID_OTP", message: "That code is not correct. Please check and try again.", issues: [{ field: "otp", message: "Incorrect code." }] };
  }

  /* Single use: consumed before the password is touched, so a failure in the
     write cannot leave a replayable code behind. */
  await markVerified(record.id);
  await invalidateOtpsForPhone(phoneE164, OTP_PURPOSE_PASSWORD_RESET);

  if (getAuthSourceMode() === "demo") {
    demoResetPasswords.set(phoneE164, password);
    clearLoginAttempts(phoneE164);
    return { ok: true, phoneMasked: maskPhone(phoneE164) };
  }

  const syntheticEmail = phoneToSyntheticEmail(phoneE164);
  const token = await requestPasswordResetToken(syntheticEmail);
  if (!token) {
    /* No account behind the number. Indistinguishable on purpose from a
       rejected code — see the non-enumeration note at the top. */
    console.warn(`[auth] password reset for ${maskPhone(phoneE164)} verified but no account was found`);
    return { ok: false, status: 400, code: "RESET_FAILED", message: "We could not reset that password. Please request a new code.", issues: [] };
  }

  const applied = await applyPasswordResetToken(token, password);
  if (!applied.ok) {
    console.error(`[auth] password reset rejected by auth provider for ${maskPhone(phoneE164)}: ${applied.reason}`);
    return { ok: false, status: 400, code: "RESET_FAILED", message: "We could not reset that password. Please request a new code.", issues: [] };
  }

  /* They just proved ownership of the number, so the failed-login budget they
     may have accumulated guessing passwords should not lock them out of the
     account they have just recovered. */
  clearLoginAttempts(phoneE164);
  return { ok: true, phoneMasked: maskPhone(phoneE164) };
}
