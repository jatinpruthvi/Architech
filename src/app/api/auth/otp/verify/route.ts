/* OTP verify + account creation endpoint – phone signup step 2.
 * Validates OTP, creates account via Better Auth synthetic email pattern.
 * Returns session cookies + redirect.
 */

import { NextResponse } from "next/server";
import { enforceMutationSafety } from "@/lib/auth/request-safety";
import { verifyOtpAndRegister } from "@/lib/auth/phone-flow";
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
      { ok: false, error: "INVALID_BODY", message: "Send JSON with phone, otp, name, password, listerType.", issues: [] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await verifyOtpAndRegister(request, {
    phone: typeof body.phone === "string" ? body.phone : "",
    otp: typeof body.otp === "string" ? body.otp : "",
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
