/* Credential sign-up endpoint.
 *
 * Registration always creates a BUYER: the role is set by the flow module and
 * never read from the request, so a self-service sign-up cannot mint a broker
 * or moderator. Broker access is granted through onboarding and a BrokerUser
 * membership row, per docs/auth/phase-1-better-auth-organizations.md.
 */
import { NextResponse } from "next/server";
import { registerWithCredentials } from "@/lib/auth/credential-flow";
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
    return NextResponse.json({ ok: false, error: "INVALID_BODY", message: "Send a JSON body with name, email and password.", issues: [] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const result = await registerWithCredentials(request, {
    name: typeof body.name === "string" ? body.name : "",
    email: typeof body.email === "string" ? body.email : "",
    password: typeof body.password === "string" ? body.password : "",
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.code, message: result.message, issues: result.issues }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }

  const next = typeof body.next === "string" ? body.next : null;
  const response = NextResponse.json({
    ok: true,
    session: result.session,
    redirectTo: resolvePostLoginPath(result.session, next),
  }, { headers: { "Cache-Control": "no-store" } });

  for (const cookie of result.cookies) response.headers.append("set-cookie", cookie);
  return response;
}
