import { NextResponse } from "next/server";
import { evaluateAllSlos, worstSloStatus } from "@/lib/observability/slo";

export const runtime = "nodejs";

export async function GET() {
  // In production these values come from the monitoring/RUM pipeline; for Phase 1
  // we evaluate against the configured targets with placeholders so the endpoint
  // is contract-stable and testable. Real values are wired by the SLO dashboard.
  const results = evaluateAllSlos({
    availability_30d: 99.98,
    api_p95_latency: 250,
    lcp_p75: 2400,
    ttfb_p95: 780,
    error_rate: 0.2,
  });
  return NextResponse.json({
    ok: true,
    status: worstSloStatus(results),
    results,
  }, { headers: { "Cache-Control": "no-store" } });
}
