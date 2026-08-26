import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { reviewListingDraft, type ModerationInput } from "@/lib/ai/moderation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "moderation.listings.write" });
  if (!isAuthorized(access)) return access.response;
  const body = await request.json().catch(() => null) as ModerationInput | null;
  if (!body) return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  return NextResponse.json({ ok: true, ...reviewListingDraft(body) }, { headers: { "Cache-Control": "no-store" } });
}
