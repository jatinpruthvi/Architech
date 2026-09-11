import { NextResponse } from "next/server";
import { getLocalBodiesForStateForServer } from "@/lib/location/server/directory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function positiveInteger(value: string | null, fallback: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request, { params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const url = new URL(request.url);
  const page = positiveInteger(url.searchParams.get("page"), 1);
  const pageSize = positiveInteger(url.searchParams.get("pageSize"), 50);
  try {
    const directory = await getLocalBodiesForStateForServer(state, page, pageSize);
    if (!directory) return NextResponse.json({ ok: false, errors: ["Unknown State or Union Territory slug."] }, { status: 404 });
    return NextResponse.json(
      { ok: true, directory },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    console.error("LGD local-body directory query failed", error);
    return NextResponse.json({ ok: false, errors: ["Local-body coverage is temporarily unavailable."] }, { status: 503 });
  }
}
