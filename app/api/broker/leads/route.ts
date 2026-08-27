import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { listLeadsForServer } from "@/lib/leads/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "lead.inbox.read" });
  if (!isAuthorized(access)) return access.response;
  const leads = await listLeadsForServer();
  return NextResponse.json({ ok: true, leads, count: leads.length }, { headers: { "Cache-Control": "no-store" } });
}
