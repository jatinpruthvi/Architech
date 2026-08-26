import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { updateLeadStatusForServer } from "@/lib/leads/server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "lead.inbox.read" });
  if (!isAuthorized(access)) return access.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "REPLIED");
  if (status !== "ACKNOWLEDGED" && status !== "REPLIED" && status !== "CLOSED") {
    return NextResponse.json({ ok: false, errors: ["Invalid lead status."] }, { status: 400 });
  }
  const result = await updateLeadStatusForServer(decodeURIComponent(id), status);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
