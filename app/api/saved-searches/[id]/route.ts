import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { deleteSavedSearchForServer } from "@/lib/saved-search/server";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeRequest(request, { permission: "saved-search.write" });
  if (!isAuthorized(access)) return access.response;
  const { id } = await params;
  /* Scoped to the caller. Deleting somebody else's saved search returns the
     same 404 as an id that does not exist, so the endpoint cannot be used to
     probe which ids are real. */
  const ok = await deleteSavedSearchForServer(decodeURIComponent(id), access.session.user.id);
  if (!ok) return NextResponse.json({ ok: false, errors: ["Saved search not found."] }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
