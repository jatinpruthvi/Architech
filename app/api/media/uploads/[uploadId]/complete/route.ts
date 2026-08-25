import { NextResponse } from "next/server";
import { completeMediaUploadForServer } from "@/lib/persistence/media-store";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  const result = await completeMediaUploadForServer(uploadId);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
