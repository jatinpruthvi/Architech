import { NextResponse } from "next/server";
import { submitListingForReview } from "@/lib/broker/workflow";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const result = submitListingForReview(draftId);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
