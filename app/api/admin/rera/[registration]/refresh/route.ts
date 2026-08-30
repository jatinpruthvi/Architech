import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { markReraStaleForServer } from "@/lib/persistence/rera-store";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ registration: string }> }) {
  const access = await authorizeRequest(request, { permission: "moderation.listings.write" });
  if (!isAuthorized(access)) return access.response;
  const { registration } = await params;
  const stateSlug = new URL(request.url).searchParams.get("state")?.trim().toLowerCase() ?? "";
  if (!/^[a-z][a-z-]{1,63}$/.test(stateSlug)) {
    return NextResponse.json({ ok: false, errors: ["State/UT slug is required."] }, { status: 400 });
  }
  const result = await markReraStaleForServer(stateSlug, decodeURIComponent(registration));
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
