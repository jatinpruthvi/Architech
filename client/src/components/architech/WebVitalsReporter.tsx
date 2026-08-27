"use client";

import { useReportWebVitals } from "next/web-vitals";
import { formatWebVitalPayload } from "@/lib/observability/web-vitals";

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
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
