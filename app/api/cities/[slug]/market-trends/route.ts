import { NextResponse } from "next/server";
import { getCityBySlug } from "@/lib/repositories";
import { cityMarketTrends } from "@/lib/realestate/market-trends";

export const runtime = "nodejs";

/** The city market-trends table that backs the data-journalism asset
    (StudyArena round-12, contestant B §2).

    Deliberately returns the report even when `publishable` is false: the
    coverage gap is part of the answer, not an error to hide. A city whose
    localities each hold one listing comes back with the figures withheld and
    `blockers` explaining why, so a caller deciding whether to publish or pitch
    the report can see the gap instead of discovering it after a journalist has
    quoted the number. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  if (!getCityBySlug(decoded)) {
    // 404s stay uncached: a mistyped slug must not pin a negative in the CDN.
    return NextResponse.json({ ok: false, errors: [`Unknown city: ${decoded}`] }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  /* Cost-reduction-audit P0.2: a deterministic report over the city's
     localities — cacheable, with the same shape as /api/locations/*. */
  return NextResponse.json(
    { ok: true, report: cityMarketTrends(decoded) },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" } },
  );
}
