import { NextResponse } from "next/server";
import { moderateListing, type ModerationDecision } from "@/lib/broker/workflow";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const body = await request.json().catch(() => ({}));
  const decision = (body.decision ?? "request_changes") as ModerationDecision;
  const reason = String(body.reason ?? "No reason supplied.");
  const result = moderateListing(draftId, decision, reason);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
