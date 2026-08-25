import { NextResponse } from "next/server";
import { createListingDraftForServer, listBrokerDraftsForServer } from "@/lib/persistence/broker-store";
import { demoBrokerSession } from "@/lib/auth/roles";
import type { ListingDraftInput } from "@/lib/broker/workflow";

export const runtime = "nodejs";

/** The broker's own drafts (all statuses), newest-edit-first. */
export async function GET() {
  const organizationId = demoBrokerSession.organization?.id ?? "demo-org-nivasa-partners";
  const drafts = await listBrokerDraftsForServer(organizationId);
  return NextResponse.json({ ok: true, drafts, count: drafts.length }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: ListingDraftInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  }

  const result = await createListingDraftForServer(body);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
}
