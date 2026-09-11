"use client";

import { useReportWebVitals } from "next/web-vitals";
import { formatWebVitalPayload } from "@/lib/observability/web-vitals";

/* RUM ingest sampling (cost-reduction-audit P1.3): every browser load that
   POSTs web-vitals is a serverless invocation + a structured log line, so at
   volume the cost scales linearly with users. Sampling client-side keeps the
   distribution signal (each kept metric is unbiased) while cutting the
   per-load fan-out. The rate is a build-time constant from
   NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE (0..1, default 1 = every metric); set
   0 to disable ingest entirely in an environment that does not need it. */
function webVitalsSampleRate(): number {
  const raw = Number(process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE ?? "1");
  if (!Number.isFinite(raw)) return 1;
  return Math.min(Math.max(raw, 0), 1);
}

export default function WebVitalsReporter() {
  const rate = webVitalsSampleRate();
  useReportWebVitals((metric) => {
    if (rate <= 0 || Math.random() >= rate) return;
    const payload = formatWebVitalPayload({
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
      navigationType: "navigationType" in metric ? String(metric.navigationType) : undefined,
    });

    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/observability/web-vitals", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/observability/web-vitals", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  });
  return null;
}
