/* Credential sign-in endpoint.
 *
 * A thin transport shell over `credential-flow.ts`: parse, delegate, attach the
 * minted cookies. Every rule that matters (validation, throttling, uniform
 * failure message, provider dispatch) lives in the flow module so it cannot be
 * bypassed by adding another caller.
 *
 * `enforceMutationSafety` runs first for the same reason every other mutation
 * route calls it: the Origin/Host check is the CSRF defence, and a login form
 * is a prime target for cross-site submission (login CSRF fixes a victim's
 * browser to an attacker's account).
 */
import { NextResponse } from "next/server";
import { signInWithCredentials } from "@/lib/auth/credential-flow";
import { enforceMutationSafety } from "@/lib/auth/request-safety";
import { resolvePostLoginPath } from "@/lib/auth/redirects";
import { canAccessBrokerDashboard } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unsafe = enforceMutationSafety(request);
  if (unsafe) return unsafe;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY", message: "Send a JSON body with email and password.", issues: [] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const result = await signInWithCredentials(request, {
    email: typeof body.email === "string" ? body.email : "",
    password: typeof body.password === "string" ? body.password : "",
  });

  if (!result.ok) {
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (result.retryAfterSeconds) headers["Retry-After"] = String(result.retryAfterSeconds);
    return NextResponse.json({ ok: false, error: result.code, message: result.message, issues: result.issues }, { status: result.status, headers });
  }

  const next = typeof body.next === "string" ? body.next : null;
  const response = NextResponse.json({
    ok: true,
    session: result.session,
    canAccessBrokerDashboard: canAccessBrokerDashboard(result.session),
    redirectTo: resolvePostLoginPath(result.session, next),
  }, { headers: { "Cache-Control": "no-store" } });

  for (const cookie of result.cookies) response.headers.append("set-cookie", cookie);
  return response;
}
