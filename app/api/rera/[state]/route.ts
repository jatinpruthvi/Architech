import { NextResponse } from "next/server";
import { verifyReraRecordForServer } from "@/lib/rera/server/provider";

export const runtime = "nodejs";

/** Jurisdiction-routed verification. An unsupported state/UT returns 501 with
 * an unavailable result; it is never checked against Gujarat as a fallback. */
export async function GET(request: Request, { params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const stateSlug = state.trim().toLowerCase();
  if (!/^[a-z][a-z-]{1,63}$/.test(stateSlug)) {
    return NextResponse.json({ ok: false, errors: ["State/UT slug is invalid."] }, { status: 400 });
  }
  const registration = new URL(request.url).searchParams.get("registration") ?? "";
  const result = await verifyReraRecordForServer(stateSlug, registration);
  if (!result.ok) return NextResponse.json(result, { status: result.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
