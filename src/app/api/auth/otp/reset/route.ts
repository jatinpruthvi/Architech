/* Forgot-password step 2 – verify the WhatsApp OTP and set a new password.
 *
 * Thin transport shell over `password-reset-flow.ts`. Deliberately returns NO
 * session: recovering an account and being signed in to it are separate
 * decisions, and minting a cookie here would make a 6-digit code a full
 * session-granting secret. The user is sent back to sign in with the password
 * they just chose.
 */

import { NextResponse } from "next/server";
import { enforceMutationSafety } from "@/lib/auth/request-safety";
import { verifyOtpAndResetPassword } from "@/lib/auth/password-reset-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unsafe = enforceMutationSafety(request);
  if (unsafe) return unsafe;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", message: "Send JSON with phone, otp and the new password.", issues: [] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await verifyOtpAndResetPassword(request, {
    phone: typeof body.phone === "string" ? body.phone : "",
    otp: typeof body.otp === "string" ? body.otp : "",
    password: typeof body.password === "string" ? body.password : "",
  });

  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (!result.ok && result.retryAfterSeconds) headers["Retry-After"] = String(result.retryAfterSeconds);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message, issues: result.issues },
      { status: result.status, headers },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      phoneMasked: result.phoneMasked,
      message: "Your password has been updated. Sign in with your mobile number and new password.",
    },
    { status: 200, headers },
  );
}
