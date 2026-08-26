import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { completeMediaUploadForServer } from "@/lib/persistence/media-store";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const access = await authorizeRequest(request, { permission: "media.upload.write" });
  if (!isAuthorized(access)) return access.response;
  const { uploadId } = await params;
  const result = await completeMediaUploadForServer(uploadId);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
