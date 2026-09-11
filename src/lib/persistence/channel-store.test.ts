import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/roles";

/* TDD for BUG-2026-001: the Prisma persistence path validated commission
 * splits with `toNumber` (accepts negatives and fractions) while the
 * in-memory path uses `toNumberOrNull` (rejects negatives, rounds to whole
 * rupees). Consequences in Prisma mode: negative commission entries can be
 * recorded, and fractional input reaches `BigInt()` which throws
 * RangeError → unhandled 500 instead of a 400. */

type MockDb = {
  $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  $executeRawUnsafe: (...args: unknown[]) => Promise<unknown>;
  $queryRawUnsafe: <T = unknown>(...args: unknown[]) => Promise<T>;
  channelDeal: { update: (args: unknown) => Promise<unknown> };
  channelNotification: { create: (args: unknown) => Promise<unknown> };
};

const { mockDb } = vi.hoisted(() => {
  const mockDb = {} as MockDb;
  return { mockDb };
});

vi.mock("@/lib/persistence/source", () => ({ isPrismaPersistence: () => true }));
vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => mockDb }));

import { saveChannelDealSplitForServer } from "./channel-store";

const dealRow = {
  id: "deal-1",
  matchId: "match-1",
  demandOrganizationId: "org-demand",
  supplyOrganizationId: "org-supply",
  demandContactUserId: null,
  supplyContactUserId: null,
  status: "OPEN",
  closeMode: "DUAL",
  splitAgreement: { type: "negotiated", summary: "Negotiated broker-channel split." },
  totalCommissionInr: 100n,
  demandBrokerShareInr: 60n,
  supplyBrokerShareInr: 40n,
  demandBrokerConfirmAt: null,
  supplyBrokerConfirmAt: null,
  closedAt: null,
  closeVersion: 1,
  erpnextSyncStatus: "PENDING",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const session: AuthSession = {
  user: { id: "user-1", name: "U", email: "u@example.com", role: "BROKER_ADMIN" },
  organization: { id: "org-demand", slug: "org-demand", name: "Org Demand", verificationStatus: "VERIFIED_PARTNER" },
  permissions: ["broker.channel.write"],
  source: "better-auth-contract-demo",
};

beforeEach(() => {
  mockDb.$transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb);
  mockDb.$executeRawUnsafe = vi.fn().mockResolvedValue(undefined);
  mockDb.$queryRawUnsafe = vi.fn().mockResolvedValue([]);
  mockDb.channelDeal = { update: vi.fn().mockResolvedValue(dealRow) };
  mockDb.channelNotification = { create: vi.fn().mockResolvedValue({ id: "n-1" }) };
});

describe("saveChannelDealSplitForServer (Prisma path) — commission amount validation", () => {
  it("rejects negative commission shares with 400 and never writes them", async () => {
    // -150 + 50 = -100 passes the "sums to total" check, but the amounts are
    // negative: this must be a 400, not a persisted negative commission.
    const result = await saveChannelDealSplitForServer(
      "deal-1",
      { totalCommissionInr: -100, demandBrokerShareInr: -150, supplyBrokerShareInr: 50 },
      session,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(mockDb.channelDeal.update).not.toHaveBeenCalled();
  });

  it("rejects a negative total with 400 even when shares are positive-looking", async () => {
    const result = await saveChannelDealSplitForServer(
      "deal-1",
      { totalCommissionInr: -100, demandBrokerShareInr: 40, supplyBrokerShareInr: -140 },
      session,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(mockDb.channelDeal.update).not.toHaveBeenCalled();
  });

  it("rejects fractional commission with 400 instead of throwing from BigInt()", async () => {
    // 50.25 + 50.25 = 100.5 passes the sum check; BigInt(100.5) then throws
    // RangeError, which surfaces as an unhandled 500. Must be a clean 400.
    await expect(
      saveChannelDealSplitForServer("deal-1", { totalCommissionInr: 100.5, demandBrokerShareInr: 50.25, supplyBrokerShareInr: 50.25 }, session),
    ).resolves.toMatchObject({ ok: false, status: 400 });
    expect(mockDb.channelDeal.update).not.toHaveBeenCalled();
  });

  it("rounds fractional input to whole rupees, matching the in-memory path", async () => {
    // toNumberOrNull semantics (src/lib/broker/channel.ts): Math.round, reject negatives.
    const result = await saveChannelDealSplitForServer(
      "deal-1",
      { totalCommissionInr: 100.4, demandBrokerShareInr: 50.2, supplyBrokerShareInr: 50.2 },
      session,
    );
    expect(result.ok).toBe(true);
    expect(mockDb.channelDeal.update).toHaveBeenCalledWith(
      { where: { id: "deal-1" }, data: expect.objectContaining({ totalCommissionInr: 100n, demandBrokerShareInr: 50n, supplyBrokerShareInr: 50n }) },
    );
  });

  /* BUG-R4-005: BUG-2026-001 closed the negative and fractional holes but not
     the CEILING. `toNumberOrNull` accepts any finite non-negative number, so a
     1e30 commission passed validation and the sum check, then reached
     BigInt(total) — which succeeds in JS at arbitrary precision — against
     "totalCommissionInr" BIGINT (max 9223372036854775807). Postgres rejects it
     as out of range: an unhandled 500 on the commission write path. */
  it("BUG-R4-005: rejects a commission past the BIGINT column range with 400", async () => {
    const result = await saveChannelDealSplitForServer(
      "deal-1",
      { totalCommissionInr: 1e30, demandBrokerShareInr: 6e29, supplyBrokerShareInr: 4e29 },
      session,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(mockDb.channelDeal.update).not.toHaveBeenCalled();
  });

  it("BUG-R4-005: any commission that does reach the write fits BIGINT", async () => {
    const PG_BIGINT_MAX = 9_223_372_036_854_775_807n;
    const result = await saveChannelDealSplitForServer(
      "deal-1",
      { totalCommissionInr: 9e14, demandBrokerShareInr: 5e14, supplyBrokerShareInr: 4e14 },
      session,
    );
    expect(result.ok).toBe(true);
    const data = (mockDb.channelDeal.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    for (const field of ["totalCommissionInr", "demandBrokerShareInr", "supplyBrokerShareInr"]) {
      expect((data[field] as bigint) <= PG_BIGINT_MAX, `${field} overflows BIGINT`).toBe(true);
    }
  });

  it("still accepts a valid integer split (regression guard)", async () => {
    const result = await saveChannelDealSplitForServer(
      "deal-1",
      { totalCommissionInr: 100, demandBrokerShareInr: 60, supplyBrokerShareInr: 40 },
      session,
    );
    expect(result.ok).toBe(true);
    expect(mockDb.channelDeal.update).toHaveBeenCalledTimes(1);
  });
});
