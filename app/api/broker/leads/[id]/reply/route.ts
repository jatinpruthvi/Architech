import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { assertLeadBelongsToOrg, updateLeadStatusForServer } from "@/lib/leads/server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "lead.inbox.read" });
  if (!isAuthorized(access)) return access.response;
  const { id } = await params;
  const leadId = decodeURIComponent(id);
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "REPLIED");
  if (status !== "ACKNOWLEDGED" && status !== "REPLIED" && status !== "CLOSED") {
    return NextResponse.json({ ok: false, errors: ["Invalid lead status."] }, { status: 400 });
  }

  /* Same ownership gate as DELETE: advancing another organization's lead
     through its workflow is as damaging as deleting it. */
  const owned = await assertLeadBelongsToOrg(leadId, access.session.organization?.id ?? "");
  if (!owned.ok) return NextResponse.json(owned, { status: owned.status });

  const result = await updateLeadStatusForServer(leadId, status);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
