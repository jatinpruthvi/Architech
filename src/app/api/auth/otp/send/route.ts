/* OTP send endpoint – phone signup step 1.
 * Uses api-connector-builder pattern: reuses Evolution provider via whatsapp-otp.ts
 * Validates phone (India-only), throttles, generates hashed OTP, sends via system WhatsApp.
 */

import { NextResponse } from "next/server";
import { enforceMutationSafety } from "@/lib/auth/request-safety";
import { sendSignupOtp } from "@/lib/auth/phone-flow";

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
      { ok: false, error: "INVALID_BODY", message: "Send JSON with phone, name, password, listerType.", issues: [] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await sendSignupOtp(request, {
    phone: typeof body.phone === "string" ? body.phone : "",
    name: typeof body.name === "string" ? body.name : "",
    password: typeof body.password === "string" ? body.password : "",
    listerType: typeof body.listerType === "string" ? body.listerType : "",
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
      phoneE164: result.phoneE164,
      phoneMasked: result.phoneMasked,
      expiresAt: result.expiresAt,
      message: `OTP sent to ${result.phoneMasked} via WhatsApp. Valid for 5 minutes.`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
