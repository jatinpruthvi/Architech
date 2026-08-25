/* Lightweight trace-span wrapper (OpenTelemetry-shaped).
   Provides an OTel-compatible, vendor-agnostic way to time server operations so
   latency SLOs can be measured and, later, exported to a real trace backend or
   the redacted log sink. No opentelemetry SDK is required to use it. */

export type TraceSpan = {
  name: string;
  route?: string;
  operation?: string;
  startMs: number;
  durationMs: number;
  attributes: Record<string, string | number | boolean>;
};

export function startSpan(name: string, attributes: Record<string, string | number | boolean> = {}): { name: string; startMs: number; attributes: Record<string, string | number | boolean> } {
  return { name, startMs: performance.now(), attributes };
}

export function endSpan(span: { name: string; startMs: number; attributes: Record<string, string | number | boolean> }, end = performance.now()): TraceSpan {
  return { name: span.name, startMs: span.startMs, durationMs: Math.round(end - span.startMs), attributes: span.attributes };
}

/** Time an async operation and capture its lag. */
export async function timed<T>(name: string, fn: () => Promise<T>): Promise<{ value: T; span: TraceSpan }> {
  const span = startSpan(name);
  const value = await fn();
  return { value, span: endSpan(span) };
}
