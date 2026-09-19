import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import {
  deleteSavedSearch,
  listSavedSearches,
  normalizeSavedSearchFilters,
  saveSavedSearch,
} from "@/lib/technoproperty/repository";

export const runtime = "nodejs";

async function scopedAccess(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.dashboard.read" });
  if (!isAuthorized(access)) return { deny: access.response, orgId: null as string | null, userId: null as string | null };
  const orgId = access.session.organization?.id;
  if (!orgId) {
    return {
      deny: NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED" }, { status: 403 }),
      orgId: null,
      userId: null,
    };
  }
  return { deny: null, orgId, userId: access.session.user.id };
}

/** The broker's saved searches with a live "new matches" count each. */
export async function GET(request: Request) {
  const gate = await scopedAccess(request);
  if (gate.deny) return gate.deny;
  const savedSearches = await listSavedSearches(gate.orgId!, gate.userId!);
  return NextResponse.json({ ok: true, savedSearches }, { headers: { "Cache-Control": "no-store" } });
}

/** Save the current list filters under a name. Ownership comes from the
 *  verified session, never the payload. */
export async function POST(request: Request) {
  const gate = await scopedAccess(request);
  if (gate.deny) return gate.deny;
  const body = (await request.json().catch(() => null)) as { name?: unknown; filters?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) {
    return NextResponse.json({ ok: false, error: "INVALID_NAME" }, { status: 400 });
  }
  const id = await saveSavedSearch(gate.orgId!, gate.userId!, name, normalizeSavedSearchFilters(body?.filters));
  return NextResponse.json({ ok: true, id }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

/** Delete one of the broker's own saved searches. */
export async function DELETE(request: Request) {
  const gate = await scopedAccess(request);
  if (gate.deny) return gate.deny;
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof body?.id !== "string" || !body.id) {
    return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 });
  }
  const deleted = await deleteSavedSearch(gate.orgId!, gate.userId!, body.id);
  if (!deleted) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
