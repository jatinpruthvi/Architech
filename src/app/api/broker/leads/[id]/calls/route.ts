import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { logLeadCall } from "@/lib/leads/calling-server";

export const runtime = "nodejs";

/* Log a self-reported call outcome (spec §4). Outcome/next-action/lost-reason
   validation lives in logLeadCall against OUTCOME_RULES; the route only adds
   the write-permission and organization guards. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "lead.inbox.write" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) return NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED", errors: ["A partner organization is required to log a call."] }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, status: 400, errors: ["A JSON body with a call outcome is required."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const result = await logLeadCall(id, organizationId, access.session.user.id, body);
  return NextResponse.json(result, { status: result.ok ? 200 : result.status, headers: { "Cache-Control": "no-store" } });
}
