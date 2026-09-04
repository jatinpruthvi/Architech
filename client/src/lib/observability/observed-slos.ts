import "server-only";

import { metricsStoreMeta, snapshotSeries } from "@/lib/observability/metrics-store";
import { SLO_METRICS, type SloInput } from "@/lib/observability/slo";

/* Builds SLO inputs from REAL observations where this process can measure
   them, and explicitly-marked target assumptions where it cannot.

   Honesty contract: a value is only `observed` when it is the percentile of
   actual recorded samples. Metrics this process cannot measure (30-day
   availability needs an external probe; 5xx rate needs a shared request
   counter across instances) report the configured target as an ASSUMPTION
   with sampleSize 0 — never dressed up as a measurement. */

const OBSERVED_SOURCES: Record<string, () => { value: number; sampleSize: number }> = {
  lcp_p75: () => {
    const snap = snapshotSeries("web_vital.LCP");
    return { value: Math.round(snap.p75), sampleSize: snap.sampleSize };
  },
  ttfb_p95: () => {
    const snap = snapshotSeries("web_vital.TTFB");
    return { value: Math.round(snap.p95), sampleSize: snap.sampleSize };
  },
  api_p95_latency: () => {
    const snap = snapshotSeries("api_search_latency_ms");
    return { value: Math.round(snap.p95), sampleSize: snap.sampleSize };
  },
};

export function currentSloInputs(): Record<string, SloInput> {
  const inputs: Record<string, SloInput> = {};
  for (const metric of SLO_METRICS) {
    const observe = OBSERVED_SOURCES[metric.id];
    const observed = observe ? observe() : null;
    if (observed && observed.sampleSize > 0 && Number.isFinite(observed.value)) {
      inputs[metric.id] = { value: observed.value, basis: "observed", sampleSize: observed.sampleSize };
    } else {
      /* No samples yet (fresh boot / pre-traffic preview): evaluate the target
         itself so the endpoint is contract-stable, and say so explicitly. */
      inputs[metric.id] = { value: metric.target, basis: "assumed-target", sampleSize: 0 };
    }
  }
  return inputs;
}

export function sloStoreMeta() {
  return metricsStoreMeta();
}
