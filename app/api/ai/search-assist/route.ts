import { NextResponse } from "next/server";
import { assistSearchQuery } from "@/lib/ai/search-assist";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = assistSearchQuery(url.searchParams.get("q") ?? "");
  /* Cost-reduction-audit P0.2: deterministic parse of the query string over
     the locality registry — same input, same output, every time. */
  return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" } });
}
