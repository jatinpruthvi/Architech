import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { reviewListingDraft, type ModerationInput } from "@/lib/ai/moderation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "moderation.listings.write" });
  if (!isAuthorized(access)) return access.response;
  const body = await request.json().catch(() => null) as ModerationInput | null;
  if (!body) return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  if (typeof body.title !== "string" || !body.title.trim() || typeof body.description !== "string") {
    return NextResponse.json({ ok: false, errors: ["A draft title and description are required for moderation review."] }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...reviewListingDraft(body) }, { headers: { "Cache-Control": "no-store" } });
}
