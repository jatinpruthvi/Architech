import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { listNotificationsForServer, markNotificationsReadForServer } from "@/lib/channel/server";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "channel.read" });
  if (!isAuthorized(access)) return access.response;

  const unreadOnly = new URL(request.url).searchParams.get("unread") === "1";
  const notifications = listNotificationsForServer(access.session, unreadOnly);
  const unreadCount = listNotificationsForServer(access.session, true).length;
  return NextResponse.json({ ok: true, notifications, unreadCount }, { headers: noStore });
}

/** Mark as read. Ids belonging to another agency are ignored, not reported. */
export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "channel.write" });
  if (!isAuthorized(access)) return access.response;

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map((id: unknown) => String(id)) : [];
  const marked = markNotificationsReadForServer(access.session, ids);
  return NextResponse.json({ ok: true, marked }, { headers: noStore });
}
