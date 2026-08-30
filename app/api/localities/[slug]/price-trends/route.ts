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
    return NextResponse.json({ ok: true, summary }, { headers: { "Cache-Control": "no-store" } });
  }
  const locality = getLocalities(citySlug).find((item) => item.slug === decoded);
  if (!locality) {
    return NextResponse.json({ ok: false, errors: ["Unknown city or locality slug."] }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const summary = localityPriceTrends(decoded, citySlug);
  return NextResponse.json({ ok: true, summary }, { headers: { "Cache-Control": "no-store" } });
}
