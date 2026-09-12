import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { connectWhatsAppAccount } from "@/lib/whatsapp/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.whatsapp.manage" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) return NextResponse.json({ ok: false, errors: ["A broker organization is required."] }, { status: 403, headers: { "Cache-Control": "no-store" } });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const companyOwnedAcknowledged = typeof body === "object" && body !== null && "companyOwnedAcknowledged" in body && (body as { companyOwnedAcknowledged?: unknown }).companyOwnedAcknowledged === true;
  const result = await connectWhatsAppAccount({ organizationId, actorUserId: access.session.user.id, companyOwnedAcknowledged });
  if (!result.ok) return NextResponse.json(result, { status: result.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
