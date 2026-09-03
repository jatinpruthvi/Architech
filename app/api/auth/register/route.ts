/* Credential sign-up endpoint.
 *
 * Registration always creates a BUYER: the role is set by the flow module and
 * never read from the request, so a self-service sign-up cannot mint a broker
 * or moderator. Broker access is granted through onboarding and a BrokerUser
 * membership row, per docs/auth/phase-1-better-auth-organizations.md.
 *
 * It DOES record `listerType` ("I am an owner" / "I am a broker"). That is a
 * self-declaration used to pre-tick the listing form's attribution checkbox,
 * and it deliberately carries no authority — the two are kept apart so the
 * form can be helpful without the sign-up becoming an escalation path.
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
    /* Declared owner/broker. Defaults the listing form only; `role` is still
       forced to BUYER inside the flow. */
    listerType: typeof body.listerType === "string" ? body.listerType : "",
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
