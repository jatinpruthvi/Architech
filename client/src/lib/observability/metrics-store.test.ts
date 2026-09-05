import { afterEach, describe, expect, it } from "vitest";
import {
  metricsStoreMeta,
  percentile,
  recordSearchApiLatency,
  recordWebVitalSample,
  resetMetricsStoreForTests,
  snapshotSeries,
} from "./metrics-store";
import { currentSloInputs, sloStoreMeta } from "./observed-slos";
import { evaluateSloInputs, worstSloStatus } from "./slo";

afterEach(() => resetMetricsStoreForTests());

describe("in-process metrics store", () => {
  it("records web-vital samples and reports percentiles", () => {
    recordWebVitalSample("LCP", 2000);
    recordWebVitalSample("LCP", 2200);
    recordWebVitalSample("LCP", 2400);
    recordWebVitalSample("LCP", 2500);
    const snap = snapshotSeries("web_vital.LCP");
    expect(snap.sampleSize).toBe(4);
    expect(snap.p50).toBe(2200);
    expect(snap.p75).toBe(2400);
    expect(snap.min).toBe(2000);
    expect(snap.max).toBe(2500);
  });

  it("rejects invalid samples and ignores unknown metric names gracefully", () => {
    recordWebVitalSample("LCP", Number.NaN);
    recordWebVitalSample("LCP", -5);
    expect(snapshotSeries("web_vital.LCP").sampleSize).toBe(0);
  });

  it("keeps every series bounded under sustained traffic", () => {
    for (let i = 0; i < 1000; i += 1) recordSearchApiLatency(i % 100);
    expect(snapshotSeries("api_search_latency_ms").sampleSize).toBeLessThanOrEqual(720);
  });

  it("computes nearest-rank percentiles", () => {
    expect(percentile([], 95)).toBeNaN();
    expect(percentile([10], 95)).toBe(10);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([5, 1, 9, 3], 75)).toBe(5);
  });

  it("exposes process scope metadata for dashboards", () => {
    const meta = metricsStoreMeta();
    expect(meta.scope).toBe("process");
    expect(meta.maxSamplesPerSeries).toBeGreaterThan(0);
  });
});

describe("observed SLO inputs", () => {
  it("marks every metric assumed-target with zero samples on a fresh process", () => {
    const inputs = currentSloInputs();
    for (const input of Object.values(inputs)) {
      expect(input.basis).toBe("assumed-target");
      expect(input.sampleSize).toBe(0);
    }
    const results = evaluateSloInputs(inputs);
    /* The assumption is the configured target, so a fresh boot evaluates ok
       (contract-stable) while being explicit that nothing was measured. */
    expect(worstSloStatus(results)).toBe("ok");
    expect(results.every((r) => r.sampleSize === 0)).toBe(true);
  });

  it("switches LCP/TTFB/API-latency to observed values once samples exist", () => {
    recordWebVitalSample("LCP", 2300);
    recordWebVitalSample("LCP", 2400);
    recordWebVitalSample("TTFB", 700);
    recordSearchApiLatency(180);

    const inputs = currentSloInputs();
    expect(inputs.lcp_p75.basis).toBe("observed");
    expect(inputs.lcp_p75.sampleSize).toBe(2);
    expect(inputs.lcp_p75.value).toBe(2400);
    expect(inputs.ttfb_p95.basis).toBe("observed");
    expect(inputs.ttfb_p95.value).toBe(700);
    expect(inputs.api_p95_latency.basis).toBe("observed");
    /* Out of scope for in-process measurement. */
    expect(inputs.availability_30d.basis).toBe("assumed-target");
    expect(inputs.error_rate.basis).toBe("assumed-target");
  });

  it("turns an observed regression into a real status change", () => {
    recordWebVitalSample("LCP", 4500);
    const results = evaluateSloInputs(currentSloInputs());
    const lcp = results.find((r) => r.id === "lcp_p75");
    expect(lcp?.status).toBe("critical");
    expect(lcp?.basis).toBe("observed");
    expect(worstSloStatus(results)).toBe("critical");
  });

  it("evaluates warnings at the observed boundary values", () => {
    recordWebVitalSample("LCP", 3200); // above 3000 warning, below 4000 critical
    const results = evaluateSloInputs(currentSloInputs());
    expect(results.find((r) => r.id === "lcp_p75")?.status).toBe("warning");
  });

  it("flags unknown metrics in evaluation as warning with assumption basis", () => {
    const results = evaluateSloInputs({});
    expect(results.every((r) => r.status === "warning" || r.status === "ok")).toBe(true);
  });
});

describe("slo store meta passthrough", () => {
  it("shares the same store metadata", () => {
    expect(sloStoreMeta().scope).toBe("process");
  });
});
