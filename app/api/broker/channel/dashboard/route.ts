import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { channelDashboardForServer } from "@/lib/persistence/channel-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.channel.read" });
  if (!isAuthorized(access)) return access.response;
  const result = await channelDashboardForServer(access.session);
  if (result.ok === false) return NextResponse.json(result, { status: (result as { status: number }).status });
  /* Cost-audit P1.1: per-session dashboard — `private` so no CDN/shared cache
     ever sees it, but a short browser-side TTL stops the panel from re-hitting
     the API (and the DB aggregates behind it) on every tab switch. */
  return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } });
}
