import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { expireChannelRequestsForServer } from "@/lib/persistence/channel-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.channel.write" });
  if (!isAuthorized(access)) return access.response;
  const result = await expireChannelRequestsForServer(access.session);
  if (result.ok === false) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
