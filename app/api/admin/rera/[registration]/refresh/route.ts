import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { markReraStaleForServer } from "@/lib/persistence/rera-store";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ registration: string }> }) {
  const access = await authorizeRequest(request, { permission: "moderation.listings.write" });
  if (!isAuthorized(access)) return access.response;
  const { registration } = await params;
  const result = await markReraStaleForServer(decodeURIComponent(registration));
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
