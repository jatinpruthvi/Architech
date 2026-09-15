/* Credential sign-up endpoint – now phone OTP based.
 *
 * Registration always creates a BUYER: role is forced in flow.
 * New flow: phone + OTP + name + password + listerType.
 * Legacy email flow kept for backward compat but deprecated.
 *
 * Primary flow is 2-step:
 * 1. POST /api/auth/otp/send -> OTP via WhatsApp
 * 2. POST /api/auth/otp/verify -> creates account (this is the real register)
 *
 * This /register endpoint now also supports phone+otp for direct registration,
 * or falls back to legacy email if email provided.
 */

import { NextResponse } from "next/server";
import { registerWithCredentials } from "@/lib/auth/credential-flow";
import { verifyOtpAndRegister } from "@/lib/auth/phone-flow";
import { enforceMutationSafety } from "@/lib/auth/request-safety";
import { resolvePostLoginPath } from "@/lib/auth/redirects";

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
      { ok: false, error: "INVALID_BODY", message: "Send JSON with phone, otp, name, password.", issues: [] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const phone = typeof body.phone === "string" ? body.phone : "";
  const otp = typeof body.otp === "string" ? body.otp : "";
  const email = typeof body.email === "string" ? body.email : "";

  let result;
  if (phone && otp) {
    // New phone OTP flow
    result = await verifyOtpAndRegister(request, {
      phone,
      otp,
      name: typeof body.name === "string" ? body.name : "",
      password: typeof body.password === "string" ? body.password : "",
      listerType: typeof body.listerType === "string" ? body.listerType : "",
    });
  } else if (phone && !otp) {
    return NextResponse.json(
      {
        ok: false,
        error: "OTP_REQUIRED",
        message: "OTP is required. First request OTP via /api/auth/otp/send, then verify.",
        issues: [{ field: "otp", message: "Enter OTP sent to your WhatsApp." }],
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  } else {
    // Legacy email fallback
    result = await registerWithCredentials(request, {
      name: typeof body.name === "string" ? body.name : "",
      email,
      password: typeof body.password === "string" ? body.password : "",
      listerType: typeof body.listerType === "string" ? body.listerType : "",
    });
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.code, message: result.message, issues: result.issues }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }

  const next = typeof body.next === "string" ? body.next : null;
  const response = NextResponse.json(
    {
      ok: true,
      session: result.session,
      redirectTo: resolvePostLoginPath(result.session, next),
    },
    { headers: { "Cache-Control": "no-store" } },
  );

  for (const cookie of result.cookies) response.headers.append("set-cookie", cookie);
  return response;
}
