import { refreshStaleReraRecordsForServer } from "./src/lib/persistence/rera-store";
import { getPrismaClient } from "./src/lib/repositories/server/prisma";
import { vi } from "vitest";

async function run() {
  console.log("Benchmark started");

  // Mock verifyReraRecordForServer to simulate network delay
  const provider = await import("./src/lib/rera/server/provider");
  provider.verifyReraRecordForServer = async (jurisdictionSlug, registrationNumber) => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return {
      ok: true,
      record: {
        registrationNumber,
        stateSlug: jurisdictionSlug,
        state: "Gujarat",
        promoterName: "Test Promoter",
        projectName: "Test Project",
        sourceUrl: "https://example.invalid/record",
        retrievedAt: new Date().toISOString(),
        parserVersion: "test-1",
        confidence: 1,
        verificationStatus: "VERIFIED",
        correctionStatus: "NONE",
        evidence: { source: "demo-rera-adapter", fieldsMatched: ["promoterName"], visibleDisclaimer: "Verify in GARVI." },
        auditTrail: [],
      }
    };
  };

  // Mock DB? We can use the actual DB if we set the env, or just mock it.
  // Wait, let's just use the vitest mocks like in the test file, or create a mock.
}
run();
