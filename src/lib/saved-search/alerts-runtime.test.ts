import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

/* TDD for BUG-2026-002: flushSavedSearchAlertDigestForServer read the
 * PENDING backlog with `take: 500` and then reported
 * `remaining = rows.length - rowsDelivered` — i.e. the unread backlog
 * beyond the 500-row window was invisible. A cron run over a 1200-row
 * backlog could report `remaining: 0` (window fully cleared) while ~700
 * rows were still PENDING. The reported remaining must reflect the TRUE
 * PENDING count, not just the window that was read. */

const { mockOutbox } = vi.hoisted(() => {
  const mockOutbox = {
    upsert: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  } as {
    upsert: Mock;
    findMany: Mock;
    count: Mock;
    updateMany: Mock;
  };
  return { mockOutbox };
});

vi.mock("@/lib/repositories/source", () => ({ isPrismaDataSource: () => true }));
vi.mock("@/lib/repositories/server/prisma", () => ({
  getPrismaClient: () => ({ savedSearchAlertOutbox: mockOutbox }),
}));

import { flushSavedSearchAlertDigestForServer } from "./alerts-runtime";

const ENV_KEYS = ["SAVED_SEARCH_ALERTS", "RESEND_API_KEY", "SAVED_SEARCH_ALERT_FROM"] as const;
const savedEnv = new Map<string, string | undefined>();

function makeRows(count: number, email = "watcher@example.com"): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${i}`,
    userId: "user-1",
    email,
    savedSearchId: `search-${i}`,
    stableId: `stable-${i}`,
    listingTitle: `Listing ${i}`,
    listingPrice: "₹1,00,00,000",
    localitySlug: "thaltej",
    citySlug: "ahmedabad",
    idempotencyKey: `stable-${i}:search-${i}`,
    status: "PENDING",
    sentAt: null,
    createdAt: new Date(Date.UTC(2026, 8, 6, 0, 0, i)),
  }));
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
  process.env.SAVED_SEARCH_ALERTS = "on";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.SAVED_SEARCH_ALERT_FROM = "Architech Alerts <alerts@architech.in>";
  vi.clearAllMocks();
  mockOutbox.count.mockResolvedValue(0);
  mockOutbox.updateMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const okFetch: Mock = vi.fn().mockResolvedValue({ ok: true, status: 200 });

describe("flushSavedSearchAlertDigestForServer — backlog accounting", () => {
  it("reports remaining from the true PENDING count, not just the 500-row window read", async () => {
    // 1200 rows are PENDING; the flush only READS the first 500.
    mockOutbox.findMany.mockResolvedValue(makeRows(500));
    // After this run clears 10 rows (digestMaxListings default), 1190 are still PENDING.
    mockOutbox.count.mockResolvedValue(1190);

    const result = await flushSavedSearchAlertDigestForServer(okFetch as unknown as typeof fetch);

    expect(result.ok).toBe(true);
    expect(result.emails).toBe(1);
    expect(result.rowsDelivered).toBe(10); // digestMaxListings = 10
    expect(result.remaining).toBe(1190); // NOT 490 (the leftover of the read window)
  });

  it("reports remaining: 0 when the backlog fits in one window", async () => {
    mockOutbox.findMany.mockResolvedValue(makeRows(3));
    mockOutbox.count.mockResolvedValue(0);

    const result = await flushSavedSearchAlertDigestForServer(okFetch as unknown as typeof fetch);

    expect(result.ok).toBe(true);
    expect(result.emails).toBe(1);
    expect(result.rowsDelivered).toBe(3);
    expect(result.remaining).toBe(0);
  });

  it("keeps the full backlog reported as remaining when the send fails", async () => {
    mockOutbox.findMany.mockResolvedValue(makeRows(500));
    mockOutbox.count.mockResolvedValue(1200); // nothing was cleared
    const failFetch: Mock = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const result = await flushSavedSearchAlertDigestForServer(failFetch as unknown as typeof fetch);

    expect(result.ok).toBe(true);
    expect(result.emailsFailed).toBe(1);
    expect(result.rowsDelivered).toBe(0);
    expect(result.remaining).toBe(1200);
    expect(mockOutbox.updateMany).not.toHaveBeenCalled();
  });
});
