export type WebVitalName = "CLS" | "FCP" | "FID" | "INP" | "LCP" | "TTFB";

export type WebVitalPayload = {
  id: string;
  name: WebVitalName | string;
  value: number;
  rating?: "good" | "needs-improvement" | "poor";
  delta?: number;
  route?: string;
  navigationType?: string;
  timestamp: string;
};

export function formatWebVitalPayload(metric: Omit<WebVitalPayload, "timestamp">): WebVitalPayload {
  return { ...metric, timestamp: new Date().toISOString() };
}

export function isCoreWebVital(name: string) {
  return name === "LCP" || name === "INP" || name === "CLS" || name === "TTFB";
}

export function metricWithinPhaseOneTarget(name: string, value: number): boolean {
  if (name === "LCP") return value <= 2500;
  if (name === "INP") return value <= 200;
  if (name === "CLS") return value <= 0.1;
  if (name === "TTFB") return value <= 800;
  return true;
}
