import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { closeRequestForServer } from "@/lib/channel/server";

export const runtime = "nodejs";

/** Withdraw a request from the channel. Owner-only, enforced in the store. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "channel.write" });
  if (!isAuthorized(access)) return access.response;

  const { id } = await params;
  const result = closeRequestForServer(decodeURIComponent(id), access.session);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true, request: result.data }, { headers: { "Cache-Control": "no-store" } });
}
