import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { saveChannelDealSplitForServer } from "@/lib/persistence/channel-store";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "broker.channel.write" });
  if (!isAuthorized(access)) return access.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await saveChannelDealSplitForServer(decodeURIComponent(id), body, access.session);
  if (result.ok === false) return NextResponse.json(result, { status: (result as { status: number }).status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
