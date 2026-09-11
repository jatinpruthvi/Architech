import { NextResponse } from "next/server";
import { compareListings } from "@/lib/ai/explain";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = compareListings(url.searchParams.get("left") ?? "", url.searchParams.get("right") ?? "");
  /* Cost-reduction-audit P0.2: pure deterministic function of (left, right)
     listing ids — identical inputs yield identical output, so a long shared
     cache is safe and cuts a serverless invocation per repeated compare. */
  return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" } });
}
