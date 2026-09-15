/* Phone validation for Indian mobiles – pure, no server-only.
 *
 * Pure and dependency-free on purpose: SAME rules must run in browser
 * (inline error) and on server (enforcement). India-only per product choice:
 * 10-digit, starts 6-9, normalized to E.164 +91.
 *
 * E.164 format: +91XXXXXXXXXX (12 chars + plus = 13, but we store 13 inc +)
 * Storage: phoneE164 String @db.VarChar(20) unique
 * Display: masked +91-•••••1234 via phoneMasked
 */

import type { CredentialIssue } from "./credentials";

export const PHONE_E164_MAX_LENGTH = 20;
export const PHONE_INDIA_LENGTH = 10;
export const PHONE_OTP_LENGTH = 6;
export const PHONE_OTP_EXPIRY_MINUTES = 5;
export const PHONE_OTP_MAX_ATTEMPTS = 5;
export const PHONE_OTP_MAX_PER_HOUR = 3;

// India mobile: 10 digits, first digit 6-9
const INDIA_MOBILE_PATTERN = /^[6-9]\d{9}$/;
const E164_INDIA_PATTERN = /^\+91[6-9]\d{9}$/;

export type PhoneField = "phone" | "otp";

export function normalizePhoneToE164(value: string): string | null {
  if (!value) return null;
  // Remove all non-digit except +
  const trimmed = value.trim();
  // If already E164 +91
  if (E164_INDIA_PATTERN.test(trimmed)) return trimmed;
  // If 10 digit
  const digitsOnly = trimmed.replace(/\D/g, "");
  // Handle 91XXXXXXXXXX (12 digits starting 91)
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91") && INDIA_MOBILE_PATTERN.test(digitsOnly.slice(2))) {
    return `+${digitsOnly}`;
  }
  // Handle 0XXXXXXXXXX (11 digits starting 0)
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0") && INDIA_MOBILE_PATTERN.test(digitsOnly.slice(1))) {
    return `+91${digitsOnly.slice(1)}`;
  }
  // Handle 10 digit
  if (digitsOnly.length === 10 && INDIA_MOBILE_PATTERN.test(digitsOnly)) {
    return `+91${digitsOnly}`;
  }
  return null;
}

export function phoneToLast4(e164: string): string {
  return e164.slice(-4);
}

export function maskPhone(e164: string): string {
  // +91XXXXXXXXXX -> +91-•••••1234
  if (!E164_INDIA_PATTERN.test(e164)) return "+91-••••••••••";
  return `+91-•••••${e164.slice(-4)}`;
}

export function validatePhone(value: string): { ok: true; e164: string } | { ok: false; issue: CredentialIssue } {
  if (!value || !value.trim()) {
    return { ok: false, issue: { field: "phone", message: "Enter your mobile number." } };
  }
  const e164 = normalizePhoneToE164(value);
  if (!e164) {
    return {
      ok: false,
      issue: {
        field: "phone",
        message: "Enter a valid 10-digit Indian mobile number starting with 6-9.",
      },
    };
  }
  return { ok: true, e164 };
}

export function validateOtp(value: string): { ok: true; otp: string } | { ok: false; issue: CredentialIssue } {
  if (!value || !value.trim()) {
    return { ok: false, issue: { field: "otp", message: "Enter the 6-digit OTP." } };
  }
  const digits = value.trim().replace(/\D/g, "");
  if (digits.length !== 6) {
    return { ok: false, issue: { field: "otp", message: "OTP must be 6 digits." } };
  }
  return { ok: true, otp: digits };
}

// For client-side display
export function formatPhoneForDisplay(e164: string): string {
  // +919876543210 -> 98765 43210
  if (!E164_INDIA_PATTERN.test(e164)) return e164;
  const ten = e164.slice(3); // 9876543210
  return `${ten.slice(0, 5)} ${ten.slice(5)}`;
}
