import { NextResponse } from "next/server";
import { getCityBySlug, getLocalities } from "@/lib/repositories";
import { cityPriceTrends, localityPriceTrends } from "@/lib/realestate/price-trends";

export const runtime = "nodejs";

/** A slug that names a city returns the city-wide summary; a slug that names a
    locality returns its summary. Anything else is a 404 — B-22: an unknown slug
    used to return 200 with an empty/zero-summary whose `name` was the slug,
    which read as authoritative data for a place that does not exist. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const citySlug = new URL(request.url).searchParams.get("city") ?? undefined;
  if (getCityBySlug(decoded)) {
    const summary = cityPriceTrends(decoded);
    /* Cost-reduction-audit P0.2: deterministic summary over the registry —
       cacheable like /api/cities/[slug]/market-trends. */
    return NextResponse.json({ ok: true, summary }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" } });
  }
  const locality = getLocalities(citySlug).find((item) => item.slug === decoded);
  if (!locality) {
    // 404s stay uncached (B-22: unknown slugs must never read as data).
    return NextResponse.json({ ok: false, errors: ["Unknown city or locality slug."] }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const summary = localityPriceTrends(decoded, citySlug);
  return NextResponse.json({ ok: true, summary }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" } });
}
