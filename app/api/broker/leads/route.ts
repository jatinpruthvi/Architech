import { NextResponse } from "next/server";
import { listLeadsForServer } from "@/lib/leads/server";

export const runtime = "nodejs";

export async function GET() {
  const leads = await listLeadsForServer();
  return NextResponse.json({ ok: true, leads, count: leads.length }, { headers: { "Cache-Control": "no-store" } });
}
