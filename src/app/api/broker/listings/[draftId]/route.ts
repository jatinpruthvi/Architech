import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import {
  archiveListingDraftForServer,
  deleteListingDraftForServer,
  resumeListingDraftForServer,
  updateListingDraftForServer,
} from "@/lib/persistence/broker-store";
import type { ListingDraftInput } from "@/lib/broker/workflow";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ draftId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const access = await authorizeRequest(request, { permission: "listing.draft.create" });
  if (!isAuthorized(access)) return access.response;
  const { draftId } = await context.params;
  let body: ListingDraftInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  }
  const result = await updateListingDraftForServer(draftId, body, access.session);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  const access = await authorizeRequest(request, { permission: "listing.draft.create" });
  if (!isAuthorized(access)) return access.response;
  const { draftId } = await context.params;
  const action = request.headers.get("x-draft-action") ?? "resume";
  const result = action === "archive"
    ? await archiveListingDraftForServer(draftId, access.session)
    : await resumeListingDraftForServer(draftId, access.session);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: RouteContext) {
  const access = await authorizeRequest(request, { permission: "listing.draft.create" });
  if (!isAuthorized(access)) return access.response;
  const { draftId } = await context.params;
  const result = await deleteListingDraftForServer(draftId, access.session);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
