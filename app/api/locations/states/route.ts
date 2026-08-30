import { NextResponse } from "next/server";
import { getIndiaLocationCoverageForServer } from "@/lib/location/server/coverage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const coverage = await getIndiaLocationCoverageForServer();
    return NextResponse.json(
      {
        ok: true,
        mode: coverage.mode,
        status: coverage.status,
        checkedAt: coverage.checkedAt,
        states: coverage.states,
        source: coverage.sources.stateRegistry,
        disclaimer: coverage.disclaimer,
      },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    console.error("state registry query failed", error);
    return NextResponse.json({ ok: false, errors: ["State and Union Territory registry is temporarily unavailable."] }, { status: 503 });
  }
}
