import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { assertLeadBelongsToOrg, deleteLeadForServer, revokeLeadConsentForServer } from "@/lib/leads/server";

export const runtime = "nodejs";

/** Soft-delete (retention-privacy) or revoke consent for a lead. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  /* Mutations carry the write grant, not the read one: a permission named
     `read` gating delete/consent-revoke was the flagged second-audit note. */
  const access = await authorizeRequest(request, { permission: "lead.inbox.write" });
  if (!isAuthorized(access)) return access.response;
  const { id } = await params;
  const leadId = decodeURIComponent(id);

  /* Permission alone is not enough: the write grant is per-role, so without
     an ownership check any broker could delete or revoke consent on any other
     organization's lead by id -- and ids were being handed out by the
     (previously unscoped) list endpoint. */
  const owned = await assertLeadBelongsToOrg(leadId, access.session.organization?.id ?? "");
  if (!owned.ok) return NextResponse.json(owned, { status: owned.status });

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "consent" ? "consent" : "delete";
  const result = mode === "consent" ? await revokeLeadConsentForServer(leadId) : await deleteLeadForServer(leadId);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
