import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { createSavedSearchForServer, listSavedSearchesForServer } from "@/lib/saved-search/server";
import type { SavedSearchInput } from "@/lib/saved-search/saved-search";

export const runtime = "nodejs";

export async function GET(request: Request = new Request("http://architech.local/api/saved-searches")) {
  const access = await authorizeRequest(request, { permission: "saved-search.read" });
  if (!isAuthorized(access)) return access.response;
  const savedSearches = await listSavedSearchesForServer();
  return NextResponse.json({ ok: true, savedSearches, count: savedSearches.length }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "saved-search.write" });
  if (!isAuthorized(access)) return access.response;
  const body = (await request.json().catch(() => null)) as SavedSearchInput | null;
  if (!body) return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  const result = await createSavedSearchForServer(body);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
