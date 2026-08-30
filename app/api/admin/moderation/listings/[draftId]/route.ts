import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { moderateListingForServer } from "@/lib/persistence/broker-store";
import type { ModerationDecision } from "@/lib/broker/workflow";

export const runtime = "nodejs";

const VALID_DECISIONS: ReadonlySet<string> = new Set<ModerationDecision>(["approve", "request_changes", "reject"]);
const MAX_REASON_CHARS = 500;

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const access = await authorizeRequest(request, { permission: "moderation.listings.write" });
  if (!isAuthorized(access)) return access.response;
  const { draftId } = await params;
  const body = await request.json().catch(() => ({}));
  const decision = String(body.decision ?? "request_changes");
  /* An unvalidated decision cast is how an unknown value silently became a
     REJECT (and, in Prisma mode, `lifecycle: undefined`). Only the three
     known actions may reach the domain. */
  if (!VALID_DECISIONS.has(decision)) {
    return NextResponse.json(
      { ok: false, errors: [`decision must be one of: ${[...VALID_DECISIONS].join(", ")}.`] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const reason = String(body.reason ?? "").trim().slice(0, MAX_REASON_CHARS) || "No reason supplied.";
  const result = await moderateListingForServer(draftId, decision as ModerationDecision, reason, access.session);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
