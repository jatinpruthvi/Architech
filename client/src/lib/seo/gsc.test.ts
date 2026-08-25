import { describe, expect, it } from "vitest";
import { DemoGscProvider, LiveGscProvider, getGscHealth, getGscProvider, getGscSourceMode } from "./gsc";

describe("Search Console provider contract", () => {
  it("defaults to the demo provider", () => {
    expect(getGscSourceMode(undefined)).toBe("demo");
    expect(getGscSourceMode("live")).toBe("live");
    expect(getGscSourceMode("disabled")).toBe("disabled");
  });

  it("returns a fixture snapshot from the demo provider", async () => {
    const snapshot = await new DemoGscProvider().fetchSnapshot();
    expect(snapshot.submittedUrls).toBeGreaterThan(0);
    expect(snapshot.sitemapErrors).toBe(0);
  });

  it("fails closed for the live provider when credentials are absent", async () => {
    await expect(new LiveGscProvider({}).fetchSnapshot()).rejects.toThrow(/GSC_CREDENTIALS/);
  });

  it("reports healthy demo health without alerting", async () => {
    const health = await getGscHealth();
    expect(health.ok).toBe(true);
    expect(health.provider).toBe("demo-gsc");
    expect(health.snapshot?.indexedUrls).toBe(10);
  });

  it("exposes a provider factory matching the source switch", () => {
    expect(getGscProvider("demo").id).toBe("demo-gsc");
    expect(getGscProvider("live").id).toBe("gsc-api");
  });
});
