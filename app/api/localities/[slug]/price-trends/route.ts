import { NextResponse } from "next/server";
import { getCityBySlug } from "@/lib/repositories";
import { cityPriceTrends, localityPriceTrends } from "@/lib/realestate/price-trends";

export const runtime = "nodejs";

/** A slug that names a city returns the city-wide summary; anything else is
    treated as a locality. `?city=` scopes the locality lookup when two cities
    could otherwise share a slug. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const citySlug = new URL(request.url).searchParams.get("city") ?? undefined;
  const summary = getCityBySlug(decoded) ? cityPriceTrends(decoded) : localityPriceTrends(decoded, citySlug);
  return NextResponse.json({ ok: true, summary }, { headers: { "Cache-Control": "no-store" } });
}
