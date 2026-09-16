import { describe, expect, it, vi, type Mock } from "vitest";

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

describe("flushSavedSearchAlertDigestForServer - perf", () => {
  it("processes many emails concurrently", async () => {
    process.env.SAVED_SEARCH_ALERTS = "on";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.SAVED_SEARCH_ALERT_FROM = "Architech Alerts <alerts@architech.in>";

    // Simulate 50 emails
    const rows = Array.from({ length: 50 }, (_, i) => ({
      id: `row-${i}`,
      userId: "user-1",
      email: `watcher${i}@example.com`,
      savedSearchId: `search-${i}`,
      stableId: `stable-${i}`,
      listingTitle: `Listing ${i}`,
      listingPrice: "₹1,00,00,000",
      localitySlug: "thaltej",
      citySlug: "ahmedabad",
      idempotencyKey: `stable-${i}:search-${i}`,
      status: "PENDING",
      sentAt: null,
      createdAt: new Date(),
    }));

    mockOutbox.findMany.mockResolvedValue(rows);
    mockOutbox.count.mockResolvedValue(0);
    mockOutbox.updateMany.mockResolvedValue({ count: 1 });

    const fetchMock = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // 10ms artificial delay
      return { ok: true, status: 200 };
    });

    const start = performance.now();
    await flushSavedSearchAlertDigestForServer(fetchMock as unknown as typeof fetch);
    const end = performance.now();

    const duration = end - start;
    console.log(`Duration: ${duration}ms`);
  });
});
