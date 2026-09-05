import { NextResponse } from "next/server";
import { metricsStoreMeta } from "@/lib/observability/metrics-store";
import { currentSloInputs } from "@/lib/observability/observed-slos";
import { evaluateSloInputs, worstSloStatus } from "@/lib/observability/slo";

export const runtime = "nodejs";

export async function GET() {
  /* Values are evaluated from real samples recorded by this process wherever
     the metric is observable in-process (LCP/TTFB RUM, search API latency);
     the rest are explicitly `assumed-target` with sampleSize 0 until the
     external monitoring pipeline feeds them. No silent placeholders. */
  const results = evaluateSloInputs(currentSloInputs());
  return NextResponse.json({
    ok: true,
    status: worstSloStatus(results),
    results,
    store: metricsStoreMeta(),
  }, { headers: { "Cache-Control": "no-store" } });
}
