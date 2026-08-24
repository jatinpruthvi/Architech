import { NextResponse } from "next/server";
import { moderateMedia, type MediaModerationStatus } from "@/lib/media/upload";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "APPROVED") as Exclude<MediaModerationStatus, "PENDING">;
  const reason = String(body.reason ?? "Moderated through Phase 1 media contract.");
  const result = moderateMedia(uploadId, status, reason);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
