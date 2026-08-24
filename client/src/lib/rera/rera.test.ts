import { beforeEach, describe, expect, it } from "vitest";
import { GET as verifyRoute } from "../../../../app/api/rera/gujarat/route";
import { POST as correctionRoute } from "../../../../app/api/rera/corrections/route";
import { POST as refreshRoute } from "../../../../app/api/admin/rera/[registration]/refresh/route";
import { requestReraCorrection, resetReraStoreForTests, resolveReraCorrection, validateReraNumber, verifyReraRecord } from "./rera";

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

  it("exposes API route contracts", async () => {
    const verifyResponse = await verifyRoute(new Request("http://example.com/api/rera/gujarat?registration=GJ%2FRERA%2FAHM%2F2026%2F04821-DEMO"));
    expect(verifyResponse.status).toBe(200);
    const verifyBody = await verifyResponse.json();
    expect(verifyBody.record.parserVersion).toBe("demo-rera-adapter-v1");

    const correctionResponse = await correctionRoute(new Request("http://example.com/api/rera/corrections", { method: "POST", body: JSON.stringify({ registrationNumber: "GJ/RERA/AHM/2026/04821-DEMO", field: "projectName", proposedValue: "Updated demo project", reason: "Project name needs editorial correction." }) }));
    expect(correctionResponse.status).toBe(201);

    const refreshResponse = await refreshRoute(new Request("http://example.com"), { params: Promise.resolve({ registration: encodeURIComponent("GJ/RERA/AHM/2026/04821-DEMO") }) });
    expect(refreshResponse.status).toBe(200);
    const refreshBody = await refreshResponse.json();
    expect(refreshBody.record.verificationStatus).toBe("STALE");
  });
});
