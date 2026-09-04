import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { respondToMatchForServer } from "@/lib/channel/server";

export const runtime = "nodejs";

/* Accept or decline a match.

   Accepting is not "connect" -- it is one half of it. The contact block in the
   response carries a number only if this accept was the second one. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "channel.write" });
  if (!isAuthorized(access)) return access.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  if (action !== "accept" && action !== "reject") {
    return NextResponse.json(
      { ok: false, errors: ["Action must be accept or reject."] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await respondToMatchForServer(decodeURIComponent(id), action, access.session);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { ok: true, match: result.data, connected: result.data.contact.connected },
    { headers: { "Cache-Control": "no-store" } },
  );
}
