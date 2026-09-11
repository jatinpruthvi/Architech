import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { getModerationQueueForServer } from "@/lib/persistence/broker-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "moderation.queue.read" });
  if (!isAuthorized(access)) return access.response;
  const drafts = await getModerationQueueForServer();
  return NextResponse.json({ ok: true, drafts, count: drafts.length }, { headers: { "Cache-Control": "no-store" } });
}
