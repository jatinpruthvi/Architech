import { NextResponse } from "next/server";
import { getIndiaLocationCoverageForServer } from "@/lib/location/server/coverage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const coverage = await getIndiaLocationCoverageForServer();
    return NextResponse.json(
      { ok: true, coverage },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=900, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    console.error("location coverage query failed", error);
    return NextResponse.json(
      { ok: false, errors: ["Location coverage is temporarily unavailable."] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
