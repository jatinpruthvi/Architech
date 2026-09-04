import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { createSavedSearchForServer, listSavedSearchesForServer } from "@/lib/saved-search/server";
import type { SavedSearchInput } from "@/lib/saved-search/saved-search";

export const runtime = "nodejs";

/* A saved search belongs to ONE person. Both handlers scope on the id from
   the verified session and never on anything the caller supplied: a saved
   search states someone's intent and budget, so leaking it across accounts is
   a privacy breach, and between competing brokers a commercial one. */
export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "saved-search.read" });
  if (!isAuthorized(access)) return access.response;
  const savedSearches = await listSavedSearchesForServer(access.session.user.id);
  return NextResponse.json({ ok: true, savedSearches, count: savedSearches.length }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "saved-search.write" });
  if (!isAuthorized(access)) return access.response;
  const body = (await request.json().catch(() => null)) as SavedSearchInput | null;
  if (!body) return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  /* Ownership comes last in the spread so a forged `userId` in the payload is
     overwritten rather than honoured. */
  const result = await createSavedSearchForServer({ ...body, userId: access.session.user.id });
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
