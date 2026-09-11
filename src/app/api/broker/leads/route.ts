import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { listLeadsForServer } from "@/lib/leads/server";

export const runtime = "nodejs";

/* One organization's lead inbox.
 *
 * Scoped on the organization from the verified session. A lead carries a
 * buyer's name, masked phone, message and the listing they asked about, so an
 * unscoped inbox exposed every broker's pipeline to every other broker. */
export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "lead.inbox.read" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, error: "ORGANIZATION_REQUIRED", errors: ["A partner organization is required to read the lead inbox."] },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  const leads = await listLeadsForServer(organizationId);
  return NextResponse.json({ ok: true, leads, count: leads.length }, { headers: { "Cache-Control": "no-store" } });
}
