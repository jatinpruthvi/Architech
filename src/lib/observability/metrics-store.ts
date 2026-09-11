import "server-only";

/* In-process rolling metrics store (dependency-free baseline).
   Records RUM web-vital samples and API latency observations in bounded ring
   buffers so SLO endpoints can evaluate REAL observed values instead of
   hardcoded placeholders. Process-local by design: on multi-instance deploys
   this is a per-replica view, which the schema states explicitly via `basis`.
   A shared store (Redis/OTel collector) can replace the impl behind the same
   function signatures without touching the routes. */

export type SampleValue = number;

const MAX_SAMPLES_PER_SERIES = 720;

type SeriesId =
  | "web_vital.LCP"
  | "web_vital.INP"
  | "web_vital.CLS"
  | "web_vital.TTFB"
  | "web_vital.FCP"
  | "web_vital.FID"
  | "api_search_latency_ms";

type MetricsState = {
  series: Map<SeriesId, SampleValue[]>;
  startedAt: string;
};

declare global {
  var __architechMetrics: MetricsState | undefined;
}

function state(): MetricsState {
  if (!globalThis.__architechMetrics) {
    globalThis.__architechMetrics = { series: new Map(), startedAt: new Date().toISOString() };
  }
  return globalThis.__architechMetrics;
}

function push(seriesId: SeriesId, value: SampleValue) {
  if (!Number.isFinite(value) || value < 0) return;
  const store = state();
  const buffer = store.series.get(seriesId) ?? [];
  buffer.push(value);
  /* Ring behaviour: drop the oldest samples once the bound is reached so a
     long-lived process never grows memory without limit. */
  if (buffer.length > MAX_SAMPLES_PER_SERIES) buffer.splice(0, buffer.length - MAX_SAMPLES_PER_SERIES);
  store.series.set(seriesId, buffer);
}

/* BUG-R4-001: the accepted series names are a CLOSED set, enforced at runtime.

   `name` arrives from the request body of the unauthenticated
   POST /api/observability/web-vitals route, so it is attacker-controlled. The
   previous guard — `seriesId.startsWith("web_vital.")` on a string that had
   just been built as `web_vital.${name}` — was true for every possible input,
   so any name minted a new Map entry. The per-series ring buffer capped
   samples at 720, but nothing capped the NUMBER of series: rotating `name`
   grew process memory without bound. Matching against this list makes the
   `SeriesId` union true at runtime, not just at compile time. */
const WEB_VITAL_NAMES: readonly string[] = ["CLS", "FCP", "FID", "INP", "LCP", "TTFB"];

/** Record one RUM web-vital sample (name is the web-vitals metric name). */
export function recordWebVitalSample(name: string, value: number) {
  if (typeof name !== "string" || !WEB_VITAL_NAMES.includes(name)) return;
  push(`web_vital.${name}` as SeriesId, value);
}
/** Record one search-API latency observation in milliseconds. */
export function recordSearchApiLatency(durationMs: number) {
  push("api_search_latency_ms", durationMs);
}

/** Nearest-rank percentile of a numeric sample list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1];
}

export type SeriesSnapshot = {
  seriesId: SeriesId;
  sampleSize: number;
  p50: number;
  p75: number;
  p95: number;
  min: number;
  max: number;
};

export function snapshotSeries(seriesId: SeriesId): SeriesSnapshot {
  const values = state().series.get(seriesId) ?? [];
  return {
    seriesId,
    sampleSize: values.length,
    p50: percentile(values, 50),
    p75: percentile(values, 75),
    p95: percentile(values, 95),
    min: values.length ? Math.min(...values) : Number.NaN,
    max: values.length ? Math.max(...values) : Number.NaN,
  };
}

export function metricsStoreMeta() {
  return {
    startedAt: state().startedAt,
    scope: "process" as const,
    maxSamplesPerSeries: MAX_SAMPLES_PER_SERIES,
    /* BUG-R4-001: the number of live series. The ring buffer bounds samples per
       series, so this is the other half of the memory bound — it must stay at
       or below the size of the closed `SeriesId` set. */
    seriesCount: state().series.size,
  };
}

/** Test hook: reset all buffers. Never exposed via HTTP. */
export function resetMetricsStoreForTests() {
  globalThis.__architechMetrics = { series: new Map(), startedAt: new Date().toISOString() };
}
