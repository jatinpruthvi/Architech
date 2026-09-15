/* Admin system WhatsApp connect – single global account for auth OTPs.
 * Reuses Evolution provider pattern but for system instance, not per-org.
 * Admin must first login into WhatsApp via QR, then system uses that number to send OTP.
 */

import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { connectSystemWhatsAppAccount } from "@/lib/auth/whatsapp-otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // ADMIN or SUPER_ADMIN can connect system WhatsApp
  const access = await authorizeRequest(request, { permission: "admin.plans.write" });
  if (!isAuthorized(access)) return access.response;

  // Additional check: only ADMIN or SUPER_ADMIN allowed (not broker)
  const role = access.session.user.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN", errors: ["Admin access required to connect system WhatsApp."] }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const result = await connectSystemWhatsAppAccount(access.session.user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: result.status ?? 502, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ ok: true, account: { status: result.status } }, { headers: { "Cache-Control": "no-store" } });
}
