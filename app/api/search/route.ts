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
        "Cache-Control": "no-store",
        "X-Architech-Search-Source": response.source,
      },
    });
  } finally {
    /* Record the real latency sample whether the query succeeded or not —
       SLOs computed only from successful requests would flatter themselves. */
    recordSearchApiLatency(performance.now() - startedAt);
  }
}
