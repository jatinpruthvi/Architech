import { NextResponse } from "next/server";
import { metricsStoreMeta } from "@/lib/observability/metrics-store";
import { currentSloInputs } from "@/lib/observability/observed-slos";
import { evaluateSloInputs, worstSloStatus } from "@/lib/observability/slo";

export const runtime = "nodejs";

/** Consolidated service status: health, SLO compliance, and service counters.
    Contract-stable so dashboards and the API contract suite can rely on shape.
    SLO values come from observed samples where measurable (see observed-slos). */
export async function GET() {
  const slos = evaluateSloInputs(currentSloInputs());
  return NextResponse.json({
    ok: true,
    service: "architech-web",
    runtime: "nodejs",
    logLevel: process.env.LOG_LEVEL ?? "info",
    sentryConfigured: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
    slo: { status: worstSloStatus(slos), results: slos, store: metricsStoreMeta() },
    endpoints: {
      health: "/api/observability/health",
      slo: "/api/observability/slo",
      webVitals: "/api/observability/web-vitals",
      errors: "/api/observability/errors",
    },
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
