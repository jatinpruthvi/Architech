import { NextResponse } from "next/server";
import { metricsStoreMeta } from "@/lib/observability/metrics-store";
import { currentSloInputs } from "@/lib/observability/observed-slos";
import { evaluateSloInputs, worstSloStatus } from "@/lib/observability/slo";
import { savedSearchAlertGate } from "@/lib/saved-search/alerts";
import { leadNotificationGate } from "@/lib/leads/notifications";
import { mediaRetentionSweepGate } from "@/lib/media/retention-runtime";
import { getAuthSourceMode } from "@/lib/auth/source";
import { getDataSourceMode } from "@/lib/repositories/source";
import { isPrismaPersistence } from "@/lib/persistence/source";

export const runtime = "nodejs";

/** Consolidated service status: health, SLO compliance, and service counters.
    Contract-stable so dashboards and the API contract suite can rely on shape.
    SLO values come from observed samples where measurable (see observed-slos).

    `activationGates` makes every boot-time runtime gate QUERYABLE instead of
    log-only: what is live, what waits on which credential NAMES, and which
    subsystems are documented single-replica (the in-process event spine used
    by SEO discovery, saved-search alerts and lead notifications — the M-5
    constraint). Values only ever report booleans and credential names: an ops
    dashboard learns that RESEND_API_KEY is missing, and can never read it. */
export async function GET() {
  const slos = evaluateSloInputs(currentSloInputs());
  const alerts = savedSearchAlertGate();
  const leadNotify = leadNotificationGate();
  const retention = mediaRetentionSweepGate();
  return NextResponse.json({
    ok: true,
    service: "architech-web",
    runtime: "nodejs",
    logLevel: process.env.LOG_LEVEL ?? "info",
    sentryConfigured: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
    activationGates: {
      publicIndexing: process.env.PUBLIC_INDEXING_ENABLED === "true",
      authSource: getAuthSourceMode(),
      dataSource: getDataSourceMode(),
      durablePersistence: isPrismaPersistence(),
      savedSearchAlerts: alerts.enabled ? { enabled: true } : { enabled: false, missing: alerts.missing },
      leadNotifications: leadNotify.enabled ? { enabled: true } : { enabled: false, missing: leadNotify.missing },
      mediaRetentionSweep: { enabled: retention.enabled, intervalMinutes: retention.intervalMinutes, mode: retention.mode },
      listingEventSpine: { mode: "in-process-single-replica" as const },
      burstRateLimiter: { mode: "in-process-single-replica" as const },
    },
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
