import { NextResponse } from "next/server";
import { createListingDraft, type ListingDraftInput } from "@/lib/broker/workflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: ListingDraftInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  }

  const result = createListingDraft(body);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
}
