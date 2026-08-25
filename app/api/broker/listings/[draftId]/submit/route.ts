import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { submitListingForReviewForServer } from "@/lib/persistence/broker-store";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const access = await authorizeRequest(request, { permission: "listing.draft.create" });
  if (!isAuthorized(access)) return access.response;
  const { draftId } = await params;
  const result = await submitListingForReviewForServer(draftId, access.session);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
