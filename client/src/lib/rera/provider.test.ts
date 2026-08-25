import { describe, expect, it } from "vitest";
import { DemoReraProvider, GujaratReraProvider } from "./provider";
import { getReraSourceMode, validateGujaratReraEnvironment } from "./source";

describe("RERA provider adapters", () => {
  it("defaults RERA source to demo", () => {
    expect(getReraSourceMode(undefined)).toBe("demo");
    expect(getReraSourceMode("gujarat")).toBe("gujarat");
  });

  it("verifies through demo provider with provenance", async () => {
    const result = await new DemoReraProvider().verify("GJ/RERA/AHM/2026/04821-DEMO");
    expect(result.ok && result.provider).toBe("demo-rera-adapter");
    expect(result.ok && result.provenance.legalGate).toBe("LEG-001");
  });

  it("validates Gujarat provider environment", () => {
    expect(validateGujaratReraEnvironment({ GUJARAT_RERA_BASE_URL: "https://gujrera.gujarat.gov.in", GUJARAT_RERA_API_KEY: "key" }).ok).toBe(true);
    expect(validateGujaratReraEnvironment({}).missing).toContain("GUJARAT_RERA_API_KEY");
  });

  it("returns configured placeholder from Gujarat provider", async () => {
    const result = await new GujaratReraProvider({ GUJARAT_RERA_BASE_URL: "https://gujrera.gujarat.gov.in", GUJARAT_RERA_API_KEY: "key" }).verify("GJ/RERA/AHM/2026/04821-DEMO");
    expect(result.ok && result.provider).toBe("gujarat-rera");
    expect(result.ok && result.provenance.parserVersion).toContain("placeholder");
  });
});
