import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { revealLeadContact } from "@/lib/leads/calling-server";

export const runtime = "nodejs";

/* The gated reveal (spec §4). Permission and ownership are enforced twice —
   here and inside revealLeadContact — because the function is the
   authorization boundary and the route keeps the uniform 401/403 shape. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "lead.inbox.write" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) return NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED", errors: ["A partner organization is required to reveal a lead."] }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  const result = await revealLeadContact(request, id, organizationId);
  return NextResponse.json(result, { status: result.ok ? 200 : result.status, headers: { "Cache-Control": "no-store" } });
}
