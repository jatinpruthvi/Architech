import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { readWhatsAppSettings } from "@/lib/whatsapp/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.whatsapp.read" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) return NextResponse.json({ ok: false, errors: ["A broker organization is required."] }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    const settings = await readWhatsAppSettings(organizationId);
    return NextResponse.json({ ok: true, ...settings, canManage: access.session.permissions.includes("broker.whatsapp.manage") || access.session.user.role === "ADMIN" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, errors: ["WhatsApp settings are unavailable."] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
