import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { cancelChannelRequestForServer } from "@/lib/persistence/channel-store";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "broker.channel.write" });
  if (!isAuthorized(access)) return access.response;
  const { id } = await params;
  const result = await cancelChannelRequestForServer(decodeURIComponent(id), access.session);
  if (result.ok === false) return NextResponse.json(result, { status: (result as { status: number }).status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
