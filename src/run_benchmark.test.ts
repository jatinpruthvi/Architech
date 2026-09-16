import { vi, test } from "vitest";

type MockDb = {
  reraRecord: {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    upsert: (args: unknown) => Promise<unknown>;
  };
  auditEvent: { create: (args: unknown) => Promise<unknown> };
};

const mockDb: MockDb = {
  reraRecord: {
    findMany: async () => {
      // Simulate 100 records
      return Array.from({ length: 100 }, (_, i) => ({
        jurisdictionSlug: "gujarat",
        registrationNumber: `R${i}`,
        verificationStatus: "STALE"
      }));
    },
    upsert: async () => {
      // Simulate DB delay
      await new Promise(resolve => setTimeout(resolve, 5));
      return {};
    }
  },
  auditEvent: {
    create: async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return { id: "audit-1" };
    }
  }
};

vi.mock("@/lib/persistence/source", () => ({ isPrismaPersistence: () => true }));
vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => mockDb }));
vi.mock("@/lib/rera/server/provider", () => ({
  verifyReraRecordForServer: async (stateSlug: string, registrationNumber: string) => {
    await new Promise(resolve => setTimeout(resolve, 10)); // simulate network delay
    return {
      ok: true,
      record: {
        registrationNumber,
        stateSlug: "gujarat",
        state: "Gujarat",
        promoterName: "Test Promoter",
        projectName: "Test Project",
        sourceUrl: "https://example.invalid/record",
        retrievedAt: "2026-09-06T00:00:00.000Z",
        parserVersion: "test-1",
        confidence: 1,
        verificationStatus: "VERIFIED",
        correctionStatus: "NONE",
        evidence: { source: "demo-rera-adapter", fieldsMatched: ["promoterName"], visibleDisclaimer: "Verify in GARVI." },
        auditTrail: [],
      }
    };
  }
}));

import { refreshStaleReraRecordsForServer } from "@/lib/persistence/rera-store";

test("benchmark", async () => {
  console.log("Starting benchmark...");
  const start = performance.now();
  const result = await refreshStaleReraRecordsForServer(100);
  const end = performance.now();
  console.log(`Benchmark completed in ${(end - start).toFixed(2)}ms`);
  console.log(`Result: ${result.refreshed} refreshed`);
});
