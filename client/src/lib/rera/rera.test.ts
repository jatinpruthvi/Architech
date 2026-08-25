import { beforeEach, describe, expect, it } from "vitest";
import { markReraStale, requestReraCorrection, resetReraStoreForTests, resolveReraCorrection, validateReraNumber, verifyReraRecord } from "./rera";

describe("RERA adapter/provenance/correction workflow", () => {
  beforeEach(() => resetReraStoreForTests());

  it("validates Gujarat RERA registration format", () => {
    expect(validateReraNumber("GJ/RERA/AHM/2026/04821-DEMO")).toBe(true);
    expect(validateReraNumber("bad-number")).toBe(false);
  });

  it("verifies seeded RERA record with provenance evidence", () => {
    const result = verifyReraRecord("GJ/RERA/AHM/2026/04821-DEMO");
    expect(result.ok && result.record?.evidence.fieldsMatched).toContain("registrationNumber");
    expect(result.ok && result.verificationStatus).toBe("VERIFIED");
  });

  it("requests and resolves corrections while marking record disputed", () => {
    const requested = requestReraCorrection({ registrationNumber: "GJ/RERA/AHM/2026/04821-DEMO", field: "promoterName", currentValue: "Nivasa Partners", proposedValue: "Nivasa Partners LLP", reason: "Promoter legal suffix is missing from the source record.", reporterEmail: "reviewer@example.com" });
    expect(requested.ok && requested.correction.status).toBe("REQUESTED");
    const disputed = verifyReraRecord("GJ/RERA/AHM/2026/04821-DEMO");
    expect(disputed.ok && disputed.record?.verificationStatus).toBe("DISPUTED");
    if (!requested.ok) throw new Error("request failed");
    const resolved = resolveReraCorrection(requested.correction.id, "RESOLVED", "Official source updated.");
    expect(resolved.ok && resolved.record?.verificationStatus).toBe("VERIFIED");
  });

  it("marks records stale for refresh workflow", () => {
    const stale = markReraStale("GJ/RERA/AHM/2026/04821-DEMO");
    expect(stale.ok && stale.record.verificationStatus).toBe("STALE");
  });
});
