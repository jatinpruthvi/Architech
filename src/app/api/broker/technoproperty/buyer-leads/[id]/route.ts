import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { deleteBuyerLead, updateBuyerLead } from "@/lib/technoproperty/repository";
import { parseLeadBody } from "../route";

export const runtime = "nodejs";

async function scopedAccess(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.dashboard.read" });
  if (!isAuthorized(access)) return { deny: access.response, orgId: null as string | null, userId: null as string | null };
  const orgId = access.session.organization?.id;
  if (!orgId) {
    return {
      deny: NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED" }, { status: 403 }),
      orgId: null,
      userId: null,
    };
  }
  return { deny: null, orgId, userId: access.session.user.id };
}

/** Replace one of the broker's own buyer leads. */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await scopedAccess(request);
  if (gate.deny) return gate.deny;
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as unknown;
  const input = parseLeadBody(body);
  if ("error" in input) {
    return NextResponse.json({ ok: false, error: input.error }, { status: 400 });
  }
  try {
    const updated = await updateBuyerLead(gate.orgId!, gate.userId!, id, input);
    if (!updated) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID";
    if (code === "BUYER_LEAD_EMPTY_NAME" || code === "INVALID_PHONE" || code === "INVALID_BUDGET") {
      return NextResponse.json({ ok: false, error: code }, { status: 400 });
    }
    throw error;
  }
}

/** Delete one of the broker's own buyer leads. */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await scopedAccess(request);
  if (gate.deny) return gate.deny;
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 });
  const deleted = await deleteBuyerLead(gate.orgId!, gate.userId!, id);
  if (!deleted) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
