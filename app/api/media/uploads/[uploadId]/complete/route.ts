import { NextResponse } from "next/server";
import { completeMediaUpload } from "@/lib/media/upload";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  const result = completeMediaUpload(uploadId);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
