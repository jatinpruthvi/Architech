/* Google Search Console provider contract (SEO-004).
   Encodes the ingestion source switch: a `demo` provider returns a fixture
   snapshot for CI/audits, while a `live` provider (needs Google credentials and
   domain verification) would call the Search Console API. The contract keeps
   telemetry, thresholds, and setup logic independent of the provider so the
   switching does not change the monitoring code. */

import { analyzeSearchConsoleSnapshot, defaultSearchConsoleThresholds, type SearchConsoleSnapshot, type SeoAlert, type SearchConsoleThresholds } from "./monitoring";

export type GscSourceMode = "demo" | "live" | "disabled";

export type GscCredentials = Partial<Record<"GSC_CREDENTIALS", string>>;

export interface GscProvider {
  id: "demo-gsc" | "gsc-api";
  fetchSnapshot(): Promise<SearchConsoleSnapshot>;
}

export const DEMO_GSC_SNAPSHOT: SearchConsoleSnapshot = {
  date: new Date().toISOString().slice(0, 10),
  submittedUrls: 10,
  indexedUrls: 10,
  excludedUrls: 0,
  clicks: 120,
  impressions: 3200,
  sitemapErrors: 0,
  coverageErrors: 0,
};

export class DemoGscProvider implements GscProvider {
  id = "demo-gsc" as const;
  async fetchSnapshot(): Promise<SearchConsoleSnapshot> {
    return { ...DEMO_GSC_SNAPSHOT, date: new Date().toISOString().slice(0, 10) };
  }
}

/** Live provider is intentionally a contract until domain verification + Google
    credentials are provisioned. It fails closed (throws) rather than fabricating
    data, so consumers must handle the not-configured case. */
export class LiveGscProvider implements GscProvider {
  id = "gsc-api" as const;
  constructor(private env: GscCredentials = process.env as GscCredentials) {}
  async fetchSnapshot(): Promise<SearchConsoleSnapshot> {
    if (!this.env.GSC_CREDENTIALS) throw new Error("GSC_CREDENTIALS is not configured; cannot fetch live Search Console data.");
    // Pending real Search Console API wiring after domain verification.
    throw new Error("Live Search Console ingestion is not yet wired; awaiting domain verification and credentials.");
  }
}

export function getGscSourceMode(value = process.env.ARCHITECH_GSC_SOURCE): GscSourceMode {
  if (value === "live") return "live";
  if (value === "disabled") return "disabled";
  return "demo";
}

export function getGscProvider(mode = getGscSourceMode()): GscProvider {
  if (mode === "live") return new LiveGscProvider();
  return new DemoGscProvider();
}

/** Fetch and analyze a snapshot, returning alerts plus the snapshot. */
export async function getGscHealth(
  thresholds: SearchConsoleThresholds = defaultSearchConsoleThresholds,
): Promise<{ provider: string; snapshot: SearchConsoleSnapshot | null; alerts: SeoAlert[]; ok: boolean }> {
  const provider = getGscProvider();
  try {
    const snapshot = await provider.fetchSnapshot();
    return { provider: provider.id, snapshot, alerts: analyzeSearchConsoleSnapshot(snapshot, undefined, thresholds), ok: true };
  } catch (error) {
    return {
      provider: provider.id,
      snapshot: null,
      alerts: [{ level: "warning", type: "setup", message: error instanceof Error ? error.message : "Search Console snapshot unavailable." }],
      ok: false,
    };
  }
}
