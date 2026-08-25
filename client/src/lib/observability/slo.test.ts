import { describe, expect, it } from "vitest";
import { evaluateAllSlos, evaluateSlo, sloFor, worstSloStatus } from "./slo";
import { endSpan, startSpan, timed } from "./trace";

const availability = {
  id: "availability_30d",
  label: "30-day availability",
  target: 99.9,
  thresholdWarning: 99.5,
  thresholdCritical: 99.0,
  unit: "%",
  direction: "higher-is-better" as const,
};

const latency = {
  id: "api_p95_latency",
  label: "Search API p95 latency",
  target: 300,
  thresholdWarning: 400,
  thresholdCritical: 600,
  unit: "ms",
  direction: "lower-is-better" as const,
};

describe("SLO evaluation & alert thresholds", () => {
  it("evaluates higher-is-better metrics (availability)", () => {
    expect(evaluateSlo(availability, 99.98)).toBe("ok");
    expect(evaluateSlo(availability, 99.4)).toBe("warning"); // below 99.5 warn threshold
    expect(evaluateSlo(availability, 98.5)).toBe("critical"); // below 99.0 critical threshold
  });

  it("evaluates lower-is-better metrics (latency)", () => {
    expect(evaluateSlo(latency, 250)).toBe("ok");
    expect(evaluateSlo(latency, 450)).toBe("warning"); // above 400 warn threshold
    expect(evaluateSlo(latency, 700)).toBe("critical"); // above 600 critical threshold
  });

  it("aggregates worst status across metrics", () => {
    expect(worstSloStatus(evaluateAllSlos({ availability_30d: 99.98, api_p95_latency: 450 }))).toBe("warning");
    expect(worstSloStatus(evaluateAllSlos({ availability_30d: 98.0, api_p95_latency: 250 }))).toBe("critical");
  });

  it("exposes a convenience per-id helper", () => {
    expect(sloFor("lcp_p75", 3200)).toBe("warning"); // above 3000 warn threshold
    expect(sloFor("unknown-metric", 0)).toBe("warning");
  });
});

describe("trace span helper", () => {
  it("times a span and an async operation", async () => {
    const span = startSpan("search", { route: "/api/search" });
    const finished = endSpan(span, span.startMs + 120);
    expect(finished.durationMs).toBe(120);
    expect(finished.attributes.route).toBe("/api/search");

    const { value, span: timedSpan } = await timed("fetch", async () => "ok");
    expect(value).toBe("ok");
    expect(timedSpan.durationMs).toBeGreaterThanOrEqual(0);
  });
});
