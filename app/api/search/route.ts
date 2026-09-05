import { NextResponse } from "next/server";
import { recordSearchApiLatency } from "@/lib/observability/metrics-store";
import { searchListingsFromSearchParamsForServer } from "@/lib/search/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const startedAt = performance.now();
  try {
    const url = new URL(request.url);
    const response = await searchListingsFromSearchParamsForServer(url.searchParams);
    return NextResponse.json(response, {
      headers: {
        /* Cost-reduction-audit P0.2: results are a deterministic read for a
           given parameter set, so a short shared (CDN) cache is safe — the
           freshness sort can drift at most 30 s for repeat visitors. 404s do
           not exist on this route (unknown cities fall back nationwide). */
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        "X-Architech-Search-Source": response.source,
      },
    });
  } finally {
    /* Record the real latency sample whether the query succeeded or not —
       SLOs computed only from successful requests would flatter themselves. */
    recordSearchApiLatency(performance.now() - startedAt);
  }
}
