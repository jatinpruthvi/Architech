import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { moderateMediaForServer } from "@/lib/persistence/media-store";
import type { MediaModerationStatus } from "@/lib/media/upload";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const access = await authorizeRequest(request, { permission: "media.moderation.write" });
  if (!isAuthorized(access)) return access.response;
  const { uploadId } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "APPROVED") as Exclude<MediaModerationStatus, "PENDING">;
  const reason = String(body.reason ?? "Moderated through Phase 1 media contract.");
  const result = await moderateMediaForServer(uploadId, status, reason);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
