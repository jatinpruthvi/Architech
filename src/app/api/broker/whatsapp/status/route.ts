import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { refreshWhatsAppConnectionState } from "@/lib/whatsapp/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.whatsapp.read" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) return NextResponse.json({ ok: false, errors: ["A broker organization is required."] }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const result = await refreshWhatsAppConnectionState(organizationId);
  return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
