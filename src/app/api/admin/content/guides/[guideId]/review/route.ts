import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { reviewGuideForServer, resolveGuide } from "@/lib/persistence/guide-review-store";
import type { GuideReviewAction } from "@/lib/content/workflow";

export const runtime = "nodejs";

/* Editorial approval endpoint (P1-CONT-001 code half): move a guide through
   draft → editorial-review → approved → published, or send it back / reject it.
   The `content.guides.write` permission gates it; the workflow in
   `content/workflow.ts` enforces the transitions and records an audit trail.
   An approval that fails the editorial gates is refused — a human sign-off can
   never override a missing source or reviewer. */

const VALID_ACTIONS: ReadonlySet<string> = new Set<GuideReviewAction>(["submit", "approve", "publish", "request_changes", "reject"]);
const MAX_REASON_CHARS = 500;

export async function POST(request: Request, { params }: { params: Promise<{ guideId: string }> }) {
  const access = await authorizeRequest(request, { permission: "content.guides.write" });
  if (!isAuthorized(access)) return access.response;

  const { guideId } = await params;
  const guide = resolveGuide(guideId);
  if (!guide) {
    return NextResponse.json({ ok: false, errors: [`No guide with id "${guideId}".`] }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      { ok: false, errors: [`action must be one of: ${[...VALID_ACTIONS].join(", ")}.`] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const reason = String(body.reason ?? "").trim().slice(0, MAX_REASON_CHARS) || undefined;

  const result = await reviewGuideForServer(guide, action as GuideReviewAction, reason, access.session);
  if (!result.ok) return NextResponse.json(result, { status: result.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true, guideId: result.record.guideId, status: result.record.status, events: result.record.events }, { headers: { "Cache-Control": "no-store" } });
}
