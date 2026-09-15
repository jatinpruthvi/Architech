/* Forgot-password step 1 – send a reset OTP over WhatsApp.
 *
 * Thin transport shell over `password-reset-flow.ts`, same shape as
 * `otp/send`. Takes only the mobile number: see the non-enumeration note in
 * that module for why nothing else is asked for, and why the 200 body is
 * identical whether or not the number is registered.
 */

import { NextResponse } from "next/server";
import { enforceMutationSafety } from "@/lib/auth/request-safety";
import { sendPasswordResetOtp } from "@/lib/auth/password-reset-flow";

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
      { ok: false, error: "INVALID_BODY", message: "Send JSON with phone.", issues: [] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await sendPasswordResetOtp(request, {
    phone: typeof body.phone === "string" ? body.phone : "",
  });

  if (!result.ok) {
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (result.retryAfterSeconds) headers["Retry-After"] = String(result.retryAfterSeconds);
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message, issues: result.issues },
      { status: result.status, headers },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      /* Masked only. `otp/send` echoes the E.164 number back as well, but
         nothing on this surface needs it — the browser already has the number
         it just typed — and a response that carries only the mask is one fewer
         place a full number can end up in a log or a capture. */
      phoneMasked: result.phoneMasked,
      expiresAt: result.expiresAt,
      /* Worded so the copy holds even when the number is unknown to us. */
      message: `If an account exists for ${result.phoneMasked}, a reset code is on its way over WhatsApp. Valid for 5 minutes.`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
