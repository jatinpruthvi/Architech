import { describe, expect, it } from "vitest";
import { DemoReraProvider, GujaratReraProvider, UnsupportedReraProvider } from "./provider";
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

  it("withholds verification for a state without an approved adapter", async () => {
    const result = await new UnsupportedReraProvider({ stateSlug: "karnataka", stateName: "Karnataka", authorityName: "Karnataka RERA", publicRegistryUrl: null }).verify("PRM/KA/RERA/1234");
    expect(result.ok).toBe(false);
    expect(result.provider).toBe("unsupported-rera-jurisdiction");
    if (!result.ok) {
      expect(result.status).toBe(501);
      expect(result.errors.join(" ")).toContain("No verification badge");
    }
  });

  it("fail-closes with 501 when 'configured' — the unimplemented adapter must not emit verdicts", async () => {
    const provider = new GujaratReraProvider({ GUJARAT_RERA_BASE_URL: "https://gujrera.gujarat.gov.in", GUJARAT_RERA_API_KEY: "key" });
    const result = await provider.verify("GJ/RERA/AHM/2026/04821-DEMO");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(501);
      /* Never imply a verification state — not even a pessimistic one — for a
         number the adapter did not actually check against the authority. */
      expect(result.errors.join(" ")).toContain("not implemented");
    }
  });
});
