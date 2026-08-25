import { NextResponse } from "next/server";
import { deleteSavedSearchForServer } from "@/lib/saved-search/server";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteSavedSearchForServer(decodeURIComponent(id));
  if (!ok) return NextResponse.json({ ok: false, errors: ["Saved search not found."] }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
