import { beforeEach, describe, expect, it, vi } from "vitest";

/* TDD for BUG-R4-004: in `refreshStaleReraRecordsForServer` the try/catch
 * wrapped ONLY the provider call (`verifyReraRecordForServer`). The
 * `reraRecord.upsert` and `auditEvent.create` that follow it sat unguarded
 * inside the `for` loop, so a write failure on one row propagated out of the
 * whole batch:
 *   - the caller (`POST /api/internal/scheduled/rera-refresh`) does not catch
 *     either, so the cron returns an unhandled 500; and
 *   - because the sweep is `where STALE orderBy updatedAt asc take limit`, and
 *     the failed row is never updated, it stays at the HEAD of every subsequent
 *     run and throws again — permanently wedging the whole STALE backlog, not
 *     merely delaying it by one cron cycle. */

type MockDb = {
  reraRecord: {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    upsert: (args: unknown) => Promise<unknown>;
  };
  auditEvent: { create: (args: unknown) => Promise<unknown> };
};

const { mockDb, verifyMock } = vi.hoisted(() => ({
  mockDb: {} as MockDb,
  verifyMock: vi.fn(),
}));

vi.mock("@/lib/persistence/source", () => ({ isPrismaPersistence: () => true }));
vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => mockDb }));
vi.mock("@/lib/rera/server/provider", () => ({
  verifyReraRecordForServer: (...args: unknown[]) => verifyMock(...args),
}));

import { refreshStaleReraRecordsForServer } from "./rera-store";

/* The function's return type is a union with the `skipped` (non-Prisma) shape,
   which carries no `errors` array. These tests always run in Prisma mode, so
   narrow once rather than repeating the cast at every assertion. */
type BatchResult = { ok: boolean; scanned: number; refreshed: number; errors: string[] };
const runBatch = (limit = 10) => refreshStaleReraRecordsForServer(limit) as Promise<BatchResult>;

function staleRow(registrationNumber: string) {
  return { jurisdictionSlug: "gujarat", registrationNumber, verificationStatus: "STALE" };
}

/* A confirmed snapshot: the only shape that reaches the write half, because
   `snapshotStatusToDb` returns null (and the loop `continue`s) for NOT_FOUND. */
function confirmed(registrationNumber: string) {
  return {
    ok: true as const,
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
      verificationStatus: "VERIFIED" as const,
      correctionStatus: "NONE" as const,
      evidence: { source: "demo-rera-adapter" as const, fieldsMatched: ["promoterName"], visibleDisclaimer: "Verify in GARVI." },
      auditTrail: [],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.reraRecord = {
    findMany: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue({}),
  };
  mockDb.auditEvent = { create: vi.fn().mockResolvedValue({ id: "audit-1" }) };
  /* Signature is verifyReraRecordForServer(stateSlug, registrationNumber). */
  verifyMock.mockImplementation((_stateSlug: string, registrationNumber: string) => Promise.resolve(confirmed(registrationNumber)));
});

describe("refreshStaleReraRecordsForServer (Prisma path) — batch resilience", () => {
  it("refreshes every confirmable row when no write fails", async () => {
    mockDb.reraRecord.findMany = vi.fn().mockResolvedValue([staleRow("R1"), staleRow("R2"), staleRow("R3")]);
    const result = await runBatch();
    expect(result).toMatchObject({ ok: true, scanned: 3, refreshed: 3 });
    expect(result.errors).toEqual([]);
  });

  it("BUG-R4-004: an upsert failure on one row must not abort the rest of the batch", async () => {
    mockDb.reraRecord.findMany = vi.fn().mockResolvedValue([staleRow("R1"), staleRow("R2"), staleRow("R3")]);
    mockDb.reraRecord.upsert = vi.fn().mockImplementation(async (args: { where: { jurisdictionSlug_registrationNumber: { registrationNumber: string } } }) => {
      if (args.where.jurisdictionSlug_registrationNumber.registrationNumber === "R2") {
        throw new Error("Invalid value provided. Expected Date, got Invalid Date.");
      }
      return {};
    });

    /* Pre-fix this REJECTED, aborting the sweep after row 2; R3 was never
       attempted and the cron route turned the rejection into a 500. */
    const result = await runBatch();

    expect(result.scanned).toBe(3);
    expect(result.refreshed).toBe(2); // R1 and R3 both landed
    expect(result.ok).toBe(false); // …but the failure is still reported
    expect(result.errors.join(" ")).toContain("gujarat:R2");
    expect(mockDb.auditEvent.create).toHaveBeenCalledTimes(2);
  });

  it("BUG-R4-004: an audit-event failure is contained the same way", async () => {
    mockDb.reraRecord.findMany = vi.fn().mockResolvedValue([staleRow("R1"), staleRow("R2")]);
    mockDb.auditEvent.create = vi.fn()
      .mockRejectedValueOnce(new Error("audit insert failed"))
      .mockResolvedValue({ id: "audit-2" });

    const result = await runBatch();

    expect(result.scanned).toBe(2);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("gujarat:R1");
    // R2 must still have been processed and written despite R1's audit failure.
    expect(mockDb.reraRecord.upsert).toHaveBeenCalledTimes(2);
    expect(result.refreshed).toBe(1);
  });

  it("BUG-R4-004: a provider failure still leaves the row STALE and the batch intact", async () => {
    mockDb.reraRecord.findMany = vi.fn().mockResolvedValue([staleRow("R1"), staleRow("R2")]);
    verifyMock.mockImplementation((_stateSlug: string, registrationNumber: string) =>
      registrationNumber === "R1" ? Promise.reject(new Error("provider unreachable")) : Promise.resolve(confirmed(registrationNumber)),
    );

    const result = await runBatch();

    expect(result).toMatchObject({ ok: false, scanned: 2, refreshed: 1 });
    expect(result.errors.join(" ")).toContain("provider unreachable");
  });
});
