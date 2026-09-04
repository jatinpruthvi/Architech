import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { channelDashboardForServer } from "@/lib/persistence/channel-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.channel.read" });
  if (!isAuthorized(access)) return access.response;
  const result = await channelDashboardForServer(access.session);
  if (result.ok === false) return NextResponse.json(result, { status: (result as { status: number }).status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
