/* Credential sign-in endpoint – now phone + password primary, email fallback for legacy.
 *
 * Thin transport shell over phone-flow and credential-flow.
 * Validates phone (India-only) or email, delegates to appropriate flow.
 */

import { NextResponse } from "next/server";
import { signInWithCredentials } from "@/lib/auth/credential-flow";
import { signInWithPhone } from "@/lib/auth/phone-flow";
import { enforceMutationSafety } from "@/lib/auth/request-safety";
import { resolvePostLoginPath } from "@/lib/auth/redirects";
import { canAccessBrokerDashboard } from "@/lib/auth/roles";
import { createDemoBridgeUrl } from "@/lib/auth/demo-accounts";

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
      { ok: false, error: "INVALID_BODY", message: "Send JSON with phone and password.", issues: [] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const phone = typeof body.phone === "string" ? body.phone : "";
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Prefer phone if provided, else fallback to email for backward compat
  let result;
  if (phone) {
    result = await signInWithPhone(request, { phone, password });
  } else if (email) {
    result = await signInWithCredentials(request, { email, password });
  } else {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", message: "Provide phone and password.", issues: [{ field: "phone", message: "Enter your mobile number." }] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!result.ok) {
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (result.retryAfterSeconds) headers["Retry-After"] = String(result.retryAfterSeconds);
    return NextResponse.json({ ok: false, error: result.code, message: result.message, issues: result.issues }, { status: result.status, headers });
  }

  const next = typeof body.next === "string" ? body.next : null;
  const destination = resolvePostLoginPath(result.session, next);
  const response = NextResponse.json(
    {
      ok: true,
      session: result.session,
      canAccessBrokerDashboard: canAccessBrokerDashboard(result.session),
      redirectTo: destination,
      /* One-time top-level sign-in link (see demo-accounts.ts): embedded
         previews that refuse to store the session cookie open this in a new
         tab, where first-party cookies always work. */
      bridgeUrl:
        result.session.source === "better-auth-contract-demo"
          ? createDemoBridgeUrl(result.session.user.id, destination)
          : undefined,
    },
    { headers: { "Cache-Control": "no-store" } },
  );

  for (const cookie of result.cookies) response.headers.append("set-cookie", cookie);
  return response;
}
