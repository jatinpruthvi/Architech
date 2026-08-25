import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { attachMediaToDraftForServer, detachMediaFromDraftForServer, listDraftMediaForServer } from "@/lib/persistence/broker-store";

export const runtime = "nodejs";

const draftIdFrom = (params: { draftId: string }) => decodeURIComponent(params.draftId);

export async function GET(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const access = await authorizeRequest(request, { permission: "broker.dashboard.read" });
  if (!isAuthorized(access)) return access.response;
  const { draftId } = await params;
  const mediaIds = await listDraftMediaForServer(draftIdFrom({ draftId }), access.session);
  return NextResponse.json({ ok: true, draftId: draftIdFrom({ draftId }), mediaIds, count: mediaIds.length }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const access = await authorizeRequest(request, { permission: "listing.draft.create" });
  if (!isAuthorized(access)) return access.response;
  const { draftId } = await params;
  const body = (await request.json().catch(() => null)) as { mediaId?: string; action?: "attach" | "detach" } | null;
  if (!body?.mediaId) return NextResponse.json({ ok: false, errors: ["mediaId is required."] }, { status: 400 });

  const action = body.action === "detach" ? "detach" : "attach";
  const result = action === "detach"
    ? await detachMediaFromDraftForServer(draftIdFrom({ draftId }), body.mediaId, access.session)
    : await attachMediaToDraftForServer(draftIdFrom({ draftId }), body.mediaId, access.session);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
