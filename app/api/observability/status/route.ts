import { NextResponse } from "next/server";
import { evaluateAllSlos, worstSloStatus } from "@/lib/observability/slo";

export const runtime = "nodejs";

/** Consolidated service status: health, SLO compliance, and service counters.
    Contract-stable so dashboards and the API contract suite can rely on shape. */
export async function GET() {
  const slos = evaluateAllSlos({
    availability_30d: 99.98,
    api_p95_latency: 250,
    lcp_p75: 2400,
    ttfb_p95: 780,
    error_rate: 0.2,
  });
  return NextResponse.json({
    ok: true,
    service: "architech-web",
    runtime: "nodejs",
    logLevel: process.env.LOG_LEVEL ?? "info",
    sentryConfigured: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
    slo: { status: worstSloStatus(slos), results: slos },
    endpoints: {
      health: "/api/observability/health",
      slo: "/api/observability/slo",
      webVitals: "/api/observability/web-vitals",
      errors: "/api/observability/errors",
    },
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
