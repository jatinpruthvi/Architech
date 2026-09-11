import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { getLeadMetricsForServer } from "@/lib/listing/details";

export const runtime = "nodejs";

/* The call-result panel the inbox already fetches (overdue / calls logged /
   lost reasons). The route was missing — this is the read side of Phase 4. */
export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "lead.inbox.read" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) return NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED", errors: ["A partner organization is required."] }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const metrics = await getLeadMetricsForServer(organizationId);
  return NextResponse.json({ ok: true, metrics }, { headers: { "Cache-Control": "no-store" } });
}
