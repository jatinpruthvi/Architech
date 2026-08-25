import { NextResponse } from "next/server";
import { listOutreachForServer, recordOutreachForServer } from "@/lib/governance/server";
import type { OutreachEntry } from "@/lib/governance/authority";

export const runtime = "nodejs";

export async function GET() {
  const outreach = await listOutreachForServer();
  return NextResponse.json({ ok: true, outreach, count: outreach.length }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as (Omit<OutreachEntry, "id"> & { reviewedBy: string }) | null;
  if (!body) return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  const result = await recordOutreachForServer(body);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
