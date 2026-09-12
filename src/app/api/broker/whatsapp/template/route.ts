import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS } from "@/lib/whatsapp/contracts";
import { readWhatsAppSettings, saveWhatsAppTemplate } from "@/lib/whatsapp/store";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.whatsapp.read" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) return NextResponse.json({ ok: false, errors: ["A broker organization is required."] }, { status: 403, headers: noStore });
  try {
    const settings = await readWhatsAppSettings(organizationId);
    return NextResponse.json({ ok: true, template: settings.template, placeholders: ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, errors: ["WhatsApp template is unavailable."] }, { status: 503, headers: noStore });
  }
}

export async function PUT(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.whatsapp.manage" });
  if (!isAuthorized(access)) return access.response;
  const organizationId = access.session.organization?.id;
  if (!organizationId) return NextResponse.json({ ok: false, errors: ["A broker organization is required."] }, { status: 403, headers: noStore });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400, headers: noStore });
  }
  const templateBody = typeof body === "object" && body !== null && "body" in body ? (body as { body?: unknown }).body : undefined;
  const result = await saveWhatsAppTemplate({ organizationId, actorUserId: access.session.user.id, body: typeof templateBody === "string" ? templateBody : "" });
  if (!result.ok) return NextResponse.json(result, { status: result.status, headers: noStore });
  return NextResponse.json({ ok: true, template: result.template, placeholders: ALLOWED_ACKNOWLEDGEMENT_PLACEHOLDERS }, { headers: noStore });
}
