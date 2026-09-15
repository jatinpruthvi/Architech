import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { getSystemWhatsAppStatus } from "@/lib/auth/whatsapp-otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "admin.plans.read" });
  if (!isAuthorized(access)) return access.response;

  const role = access.session.user.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const result = await getSystemWhatsAppStatus();
  return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
