import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { processPendingErpnextCloseWritesForServer } from "@/lib/persistence/channel-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.channel.write" });
  if (!isAuthorized(access)) return access.response;
  const body = await request.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(25, Number(body.limit ?? 10)));
  const result = await processPendingErpnextCloseWritesForServer(access.session, limit);
  return NextResponse.json(result, { status: result.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
}
