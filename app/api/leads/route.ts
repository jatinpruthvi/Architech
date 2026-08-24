import { NextResponse } from "next/server";
import type { LeadInput } from "@/lib/leads/lead";
import { createLeadForServer } from "@/lib/leads/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Partial<LeadInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  }

  const result = await createLeadForServer(body as LeadInput);
  if (!result.ok) return NextResponse.json(result, { status: result.status });

  return NextResponse.json(result, {
    status: result.duplicate ? 200 : 201,
    headers: {
      "Cache-Control": "no-store",
      "X-Architech-Lead-Mode": result.lead.mode,
      "X-Architech-Audit-Event": result.lead.auditEvent.id,
    },
  });
}
