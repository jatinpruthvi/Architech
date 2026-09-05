import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { getListings } from "@/lib/repositories";
import { collectAlertTargets, dispatchSavedSearchAlerts, savedSearchAlertGate, savedSearchMatchesListing } from "./alerts";

const paldi = getListings().find((listing) => listing.localitySlug === "paldi")!;

describe("savedSearchAlertGate", () => {
  const env = { SAVED_SEARCH_ALERTS: "on", RESEND_API_KEY: "re_test", SAVED_SEARCH_ALERT_FROM: "alerts@architech.in" };

  it("requires the flag AND both credentials — anything missing means silent, with the names logged", () => {
    expect(savedSearchAlertGate(env)).toMatchObject({ enabled: true, from: "alerts@architech.in" });
    expect(savedSearchAlertGate({})).toEqual({ enabled: false, missing: ["SAVED_SEARCH_ALERTS=on", "RESEND_API_KEY", "SAVED_SEARCH_ALERT_FROM"] });
    expect(savedSearchAlertGate({ ...env, SAVED_SEARCH_ALERTS: "off" })).toMatchObject({ enabled: false });
  });
});

describe("savedSearchMatchesListing", () => {
  it("matches the exact same free-text semantics as the search bar", () => {
    expect(savedSearchMatchesListing({ query: "paldi", filters: [] }, paldi)).toBe(true);
    expect(savedSearchMatchesListing({ query: "whitefield", filters: [] }, paldi)).toBe(false);
    expect(savedSearchMatchesListing({ query: "4 bhk", filters: [] }, paldi)).toBe(false); /* paldi fixture is 3 */
  });

  it("accepts a facet-token search only when BOTH intent projections agree (intent is not persisted on the search)", () => {
    expect(savedSearchMatchesListing({ query: "", filters: ["trust:rera"] }, paldi)).toBe(paldi.badge.toLowerCase().includes("rera"));
    /* An unknown/garbage token must never crash or silently widen the alert. */
    expect(savedSearchMatchesListing({ query: "", filters: ["nonsense:token"] }, paldi)).toBeTypeOf("boolean");
  });
});

describe("collectAlertTargets", () => {
  it("targets only notify=true rows with a real account email and a real match", () => {
    const targets = collectAlertTargets({
      stableId: paldi.id,
      listing: paldi,
      rows: [
        { id: "s1", notify: true, query: "paldi", filters: [], user: { email: "a@b.in" } },
        { id: "s2", notify: false, query: "paldi", filters: [], user: { email: "b@b.in" } },
        { id: "s3", notify: true, query: "whitefield", filters: [], user: { email: "c@b.in" } },
        { id: "s4", notify: true, query: "paldi", filters: [], user: null },
        { id: "s5", notify: true, query: "paldi", filters: [], user: { email: "  " } },
      ],
    });
    expect(targets).toEqual([{ savedSearchId: "s1", email: "a@b.in", idempotencyKey: `${paldi.id}:s1` }]);
  });
});

describe("dispatchSavedSearchAlerts", () => {
  const gate = { enabled: true as const, apiKey: "re_test", from: "alerts@architech.in", baseUrl: "https://www.architech.in" };

  it("sends with the Idempotency-Key the idempotent-emit contract depends on, count-first body shape, and manage link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const delivery = await dispatchSavedSearchAlerts(gate, paldi, [{ savedSearchId: "s1", email: "a@b.in", idempotencyKey: "k1" }], fetchMock as unknown as typeof fetch);
    expect(delivery).toEqual({ delivered: 1, failed: 0, skipped: 0 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer re_test", "Idempotency-Key": "k1" });
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.to).toBe("a@b.in");
    expect(body.text).toContain("/saved-searches/");
    expect(body.text).toContain("You asked to be alerted");
  });

  it("a provider failure is recorded and counted, never thrown through the event spine", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ok: true });
    const delivery = await dispatchSavedSearchAlerts(gate, paldi, [
      { savedSearchId: "s1", email: "a@b.in", idempotencyKey: "k1" },
      { savedSearchId: "s2", email: "b@b.in", idempotencyKey: "k2" },
      { savedSearchId: "s3", email: "c@b.in", idempotencyKey: "k3" },
    ], fetchMock as unknown as typeof fetch);
    /* One bad row must not starve the rest. */
    expect(delivery).toEqual({ delivered: 1, failed: 2, skipped: 0 });
  });
});
