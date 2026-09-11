/* Service-Level Objectives (SLOs) and alert thresholds.
   Encodes measurable targets per endpoint class / web vital so the platform can
   alert when reliability or performance drifts, independent of any vendor.
   Deterministic and server-safe. */

export type SloStatus = "ok" | "warning" | "critical";

export type SloMetric = {
  id: string;
  label: string;
  target: number;
  thresholdWarning: number;
  thresholdCritical: number;
  unit: string;
  /** Higher is better (e.g. availability) vs lower is better (latency). */
  direction: "higher-is-better" | "lower-is-better";
};

export type SloResult = {
  status: SloStatus;
};

/**
 * Where an SLO input value came from:
 * - `observed`        — computed from real samples recorded by this process
 * - `assumed-target`  — no samples exist yet; the configured target is used as
 *                       the assumed value so dashboards stay contract-stable,
 *                       and consumers can see it is NOT a measurement.
 */
export type SloValueBasis = "observed" | "assumed-target";

export type SloInput = {
  value: number;
  basis: SloValueBasis;
  /** Number of real samples behind the value; 0 when basis is assumed-target. */
  sampleSize: number;
};

export type SloResultDetailed = SloResult & {
  id: string;
  value: number;
  basis: SloValueBasis;
  sampleSize: number;
};

export const SLO_METRICS: SloMetric[] = [
  { id: "availability_30d", label: "30-day availability", target: 99.9, thresholdWarning: 99.5, thresholdCritical: 99.0, unit: "%", direction: "higher-is-better" },
  { id: "api_p95_latency", label: "Search API p95 latency", target: 300, thresholdWarning: 400, thresholdCritical: 600, unit: "ms", direction: "lower-is-better" },
  { id: "lcp_p75", label: "LCP p75", target: 2500, thresholdWarning: 3000, thresholdCritical: 4000, unit: "ms", direction: "lower-is-better" },
  { id: "ttfb_p95", label: "TTFB p95", target: 800, thresholdWarning: 1000, thresholdCritical: 1500, unit: "ms", direction: "lower-is-better" },
  { id: "error_rate", label: "5xx error rate", target: 0.5, thresholdWarning: 1.0, thresholdCritical: 2.0, unit: "%", direction: "lower-is-better" },
];

export function evaluateSlo(metric: SloMetric, value: number): SloStatus {
  if (metric.direction === "higher-is-better") {
    if (value < metric.thresholdCritical) return "critical";
    if (value < metric.thresholdWarning) return "warning";
    return "ok";
  }
  if (value > metric.thresholdCritical) return "critical";
  if (value > metric.thresholdWarning) return "warning";
  return "ok";
}

export function evaluateAllSlos(values: Record<string, number>): Array<SloResult & { id: string; value: number }> {
  return SLO_METRICS.map((metric) => {
    const value = values[metric.id];
    if (value === undefined) return { id: metric.id, status: "warning" as SloStatus, value: Number.NaN };
    return { id: metric.id, status: evaluateSlo(metric, value), value };
  });
}

/**
 * Detailed variant: evaluates SLOs from inputs that carry provenance, so the
 * response can distinguish a measured value from a configured assumption.
 */
export function evaluateSloInputs(inputs: Record<string, SloInput>): SloResultDetailed[] {
  return SLO_METRICS.map((metric) => {
    const input = inputs[metric.id];
    if (!input || !Number.isFinite(input.value)) {
      return { id: metric.id, status: "warning" as SloStatus, value: Number.NaN, basis: "assumed-target" as const, sampleSize: 0 };
    }
    return { id: metric.id, status: evaluateSlo(metric, input.value), value: input.value, basis: input.basis, sampleSize: input.sampleSize };
  });
}

export function worstSloStatus(results: Array<SloResult & { id: string }>): SloStatus {
  if (results.some((result) => result.status === "critical")) return "critical";
  if (results.some((result) => result.status === "warning")) return "warning";
  return "ok";
}

/** Convenience helper for a single metric's status. */
export function sloFor(id: string, value: number): SloStatus {
  const metric = SLO_METRICS.find((item) => item.id === id);
  if (!metric) return "warning";
  return evaluateSlo(metric, value);
}
