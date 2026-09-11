import { NextResponse } from "next/server";
import { SUPER_ADMIN_COOKIE } from "@/lib/auth/super-admin";

export const runtime = "nodejs";

/* Idempotent: clearing an absent cookie is the same 200 (spec §6.2). */
export async function POST(request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": `${SUPER_ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}` } });
}
