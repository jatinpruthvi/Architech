import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { listChannelNotificationsForServer } from "@/lib/persistence/channel-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.channel.read" });
  if (!isAuthorized(access)) return access.response;
  const result = await listChannelNotificationsForServer(access.session);
  if (result.ok === false) return NextResponse.json(result, { status: (result as { status: number }).status });
  /* Cost-audit P1.1: short private browser TTL (see dashboard route). */
  return NextResponse.json({ ok: true, notifications: result.notifications, count: result.notifications.length }, { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } });
}
