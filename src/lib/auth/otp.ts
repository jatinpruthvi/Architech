/* OTP generation, hashing, validation – server-only for hashing part,
 * but generation constants are shared.
 *
 * Security:
 * - OTP is 6-digit numeric, crypto random
 * - Stored as HMAC SHA256 with server secret, not plaintext
 * - Constant-time compare
 * - Expiry 5 min, max 5 attempts
 * - Rate limit 3/hour/phone (enforced in service)
 */

import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_HOUR = 3;

/* OTP purposes. `OtpVerification.purpose` is a plain discriminator, and keeping
   the two flows on SEPARATE values is a security property, not tidiness: a code
   a user requested to create an account must never be accepted to change that
   account's password, and vice versa. Every store call takes `purpose`, so a
   signup code and a reset code for the same number are different rows and can
   never satisfy each other's lookup. Fits `@db.VarChar(20)`. */
export const OTP_PURPOSE_SIGNUP = "signup";
export const OTP_PURPOSE_PASSWORD_RESET = "password-reset";

/** Fixed code used when there is no real WhatsApp sender wired up, so the flow
 *  stays exercisable in previews and CI. Mirrors the signup flow's behaviour. */
export const DEMO_OTP = "123456";

function getOtpSecret(): string {
  // Reuse existing HMAC key if present, else BETTER_AUTH_SECRET, else dev fallback (not for prod)
  return (
    process.env.ARCHITECH_OTP_HMAC_KEY ??
    process.env.ARCHITECH_IDEMPOTENCY_HMAC_KEY ??
    process.env.BETTER_AUTH_SECRET ??
    "dev-only-otp-secret-change-me"
  );
}

export function generateOtp(): string {
  // 100000-999999
  const num = randomInt(100000, 1000000);
  return String(num);
}

export function hashOtp(otp: string): string {
  const secret = getOtpSecret();
  return createHmac("sha256", secret).update(otp).digest("hex");
}

export function verifyOtpHash(otp: string, hash: string): boolean {
  const computed = hashOtp(otp);
  try {
    // timingSafeEqual requires same length buffers
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function otpExpiryDate(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MS);
}

export function isOtpExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now();
}

export function formatOtpMessage(otp: string): string {
  return `Your Architech verification code is ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;
}

/* A reset code is worth more than a signup code — it changes the password of an
   account that already exists — so the wording says what it is for and names
   the phishing pattern users actually fall for. */
export function formatResetOtpMessage(otp: string): string {
  return `Your Architech password reset code is ${otp}. Valid for 5 minutes. Do not share it — Architech staff will never ask for this code.`;
}

/** Message body for a given purpose, so the sender cannot drift from the
 *  discriminator the code was stored under. */
export function formatOtpMessageFor(purpose: string, otp: string): string {
  return purpose === OTP_PURPOSE_PASSWORD_RESET ? formatResetOtpMessage(otp) : formatOtpMessage(otp);
}

