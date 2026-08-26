import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { deleteLeadForServer, revokeLeadConsentForServer } from "@/lib/leads/server";

export const runtime = "nodejs";

/** Soft-delete (retention-privacy) or revoke consent for a lead. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "lead.inbox.read" });
  if (!isAuthorized(access)) return access.response;
  const { id } = await params;
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "consent" ? "consent" : "delete";
  const result = mode === "consent" ? await revokeLeadConsentForServer(decodeURIComponent(id)) : await deleteLeadForServer(decodeURIComponent(id));
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
