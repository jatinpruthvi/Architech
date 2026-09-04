import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { listMyMatchesForServer } from "@/lib/channel/server";

export const runtime = "nodejs";

/* Matches this agency participates in.

   Each entry already carries the counterparty's contact block, built by
   counterpartyContact -- which omits the phone number entirely unless both
   sides accepted. The route does not decide what to hide. */
export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "channel.read" });
  if (!isAuthorized(access)) return access.response;

  const matches = await listMyMatchesForServer(access.session);
  return NextResponse.json(
    { ok: true, matches, count: matches.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
