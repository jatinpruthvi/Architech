import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { deleteMediaForServer, requestMediaTakedownForServer } from "@/lib/persistence/media-store";

export const runtime = "nodejs";

/** Request a takedown (holding) or confirm deletion of a media record. */
export async function POST(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const access = await authorizeRequest(request, { permission: "media.moderation.write" });
  if (!isAuthorized(access)) return access.response;
  const { uploadId } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") === "delete" ? "delete" : "takedown";
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason ?? "Moderated through Phase 1 media contract.");

  const result = action === "delete" ? await deleteMediaForServer(decodeURIComponent(uploadId)) : await requestMediaTakedownForServer(decodeURIComponent(uploadId), reason);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
