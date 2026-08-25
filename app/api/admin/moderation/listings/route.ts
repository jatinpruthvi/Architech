import { NextResponse } from "next/server";
import { getModerationQueueForServer } from "@/lib/persistence/broker-store";

export const runtime = "nodejs";

export async function GET() {
  const drafts = await getModerationQueueForServer();
  return NextResponse.json({ ok: true, drafts, count: drafts.length }, { headers: { "Cache-Control": "no-store" } });
}
