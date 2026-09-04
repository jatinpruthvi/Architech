import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { createChannelRequestForServer, listChannelRequestsForServer } from "@/lib/persistence/channel-store";
import type { ChannelRequestInput } from "@/lib/broker/channel";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.channel.read" });
  if (!isAuthorized(access)) return access.response;
  const result = await listChannelRequestsForServer(access.session);
  if (result.ok === false) return NextResponse.json(result, { status: (result as { status: number }).status });
  return NextResponse.json({ ok: true, requests: result.requests, count: result.requests.length }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.channel.write" });
  if (!isAuthorized(access)) return access.response;
  let body: ChannelRequestInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  }
  const result = await createChannelRequestForServer(body, access.session);
  if (result.ok === false) return NextResponse.json(result, { status: (result as { status: number }).status });
  return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
}
