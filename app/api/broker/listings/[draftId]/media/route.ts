import { NextResponse } from "next/server";
import { attachMediaToDraftForServer, detachMediaFromDraftForServer, listDraftMediaForServer } from "@/lib/persistence/broker-store";

export const runtime = "nodejs";

const draftIdFrom = (params: { draftId: string }) => decodeURIComponent(params.draftId);

export async function GET(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const mediaIds = await listDraftMediaForServer(draftIdFrom({ draftId }));
  return NextResponse.json({ ok: true, draftId: draftIdFrom({ draftId }), mediaIds, count: mediaIds.length }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const body = (await request.json().catch(() => null)) as { mediaId?: string; action?: "attach" | "detach" } | null;
  if (!body?.mediaId) return NextResponse.json({ ok: false, errors: ["mediaId is required."] }, { status: 400 });

  const action = body.action === "detach" ? "detach" : "attach";
  const result = action === "detach"
    ? await detachMediaFromDraftForServer(draftIdFrom({ draftId }), body.mediaId)
    : await attachMediaToDraftForServer(draftIdFrom({ draftId }), body.mediaId);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
