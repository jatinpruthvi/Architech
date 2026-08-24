import { describe, expect, it } from "vitest";
import { GET as healthRoute } from "../../../../app/api/observability/health/route";
import { POST as webVitalsRoute } from "../../../../app/api/observability/web-vitals/route";
import { formatWebVitalPayload, isCoreWebVital, metricWithinPhaseOneTarget } from "./web-vitals";

describe("observability contracts", () => {
  it("formats web vital payloads", () => {
    const payload = formatWebVitalPayload({ id: "v1", name: "LCP", value: 1200, route: "/" });
    expect(payload.timestamp).toMatch(/T/);
    expect(payload.name).toBe("LCP");
  });

  it("checks core web vital targets", () => {
    expect(isCoreWebVital("LCP")).toBe(true);
    expect(metricWithinPhaseOneTarget("LCP", 2400)).toBe(true);
    expect(metricWithinPhaseOneTarget("LCP", 2600)).toBe(false);
  });

  it("accepts web vital API payloads", async () => {
    const response = await webVitalsRoute(new Request("http://example.com/api/observability/web-vitals", { method: "POST", body: JSON.stringify(formatWebVitalPayload({ id: "v1", name: "CLS", value: 0.02, route: "/" })) }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.withinTarget).toBe(true);
  });

  it("exposes health route", async () => {
    const response = await healthRoute();
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.rumEndpoint).toBe("/api/observability/web-vitals");
  });
});
