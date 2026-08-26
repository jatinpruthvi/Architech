import { NextResponse } from "next/server";
import { cityPriceTrends, localityPriceTrends } from "@/lib/realestate/price-trends";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const summary = decoded === "ahmedabad" ? cityPriceTrends() : localityPriceTrends(decoded);
  return NextResponse.json({ ok: true, summary }, { headers: { "Cache-Control": "no-store" } });
}
