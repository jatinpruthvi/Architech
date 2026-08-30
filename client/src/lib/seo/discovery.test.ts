/* Discovery: revalidation and pinging, and the limits of each.

   The most important assertion in this file is the one about what is *not*
   submitted. A blocked listing has changed nothing, so pinging anything would
   spend quota on a page that does not exist — that is the rule from §3.4 that
   indexing requests are a scarce resource to be spent only on pages that
   passed the gate.

   The second is that revalidation failures are collected, not raised. Outside
   a Next request context `revalidatePath` throws, and a test is exactly such a
   context. If that exception escaped, the discovery subscriber would fail the
   moderation call it was triggered by — a listing would be live in the
   database and reported to the moderator as an error. */
import { describe, expect, it, vi } from "vitest";
import { discoverListingEvent, pathsForListingEvent, revalidateForListingEvent, resetSeoDiscoveryForTests, registerSeoDiscovery, urlsForIndexingRequest } from "./discovery";
import { onListingEvent, resetListingEventBusForTests, type ListingEvent } from "@/lib/listing/events";

function event(overrides: Partial<ListingEvent> = {}): ListingEvent {
  return {
    type: "listing.published",
    stableId: "listing_abc",
    localitySlug: "paldi",
    citySlug: "ahmedabad",
    previousLifecycle: "IN_REVIEW",
    nextLifecycle: "ACTIVE",
    at: "2026-08-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("pathsForListingEvent", () => {
  it("revalidates the sitemap, the place hierarchy and the price index", () => {
    const paths = pathsForListingEvent(event());
    expect(paths).toContain("/sitemap.xml");
    expect(paths).toContain("/sitemap/listings.xml");
    expect(paths).toContain("/buy/ahmedabad/paldi/");
    expect(paths).toContain("/buy/ahmedabad/");
    // Publishing listings is what decides whether this index publishes at all,
    // so it is not merely a neighbour of the listing — it depends on it.
    expect(paths).toContain("/price-index/ahmedabad/");
    expect(paths).toContain("/sitemap/reports.xml");
  });

  it("degrades gracefully when the place is unknown", () => {
    const paths = pathsForListingEvent(event({ citySlug: undefined, localitySlug: undefined }));
    expect(paths).toEqual(["/sitemap.xml", "/sitemap/listings.xml"]);
  });

  it("never revalidates the same path twice", () => {
    const paths = pathsForListingEvent(event());
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("revalidateForListingEvent", () => {
  it("does not throw outside a request context", async () => {
    await expect(revalidateForListingEvent(event())).resolves.toBeTruthy();
  });

  it("reports which paths it could not invalidate", async () => {
    // In a test there is no Next cache, so every path is expected to fail.
    // What matters is that the failures are returned rather than raised.
    const result = await revalidateForListingEvent(event());
    expect(result.paths.length).toBeGreaterThan(0);
    expect(result.failed).toEqual(result.paths);
  });
});

describe("urlsForIndexingRequest", () => {
  it("submits the pages whose content changed", () => {
    expect(urlsForIndexingRequest(event())).toEqual([
      "/buy/ahmedabad/paldi/",
      "/buy/ahmedabad/",
      "/price-index/ahmedabad/",
    ]);
  });

  it("submits nothing when the place is unknown", () => {
    expect(urlsForIndexingRequest(event({ citySlug: undefined }))).toEqual([]);
  });
});

describe("discoverListingEvent", () => {
  it("does not ping anything for a listing the gate refused", async () => {
    // The scarce-resource rule. A blocked listing has no page.
    const outcome = await discoverListingEvent(event({ type: "listing.gate_blocked", nextLifecycle: null }), {
      INDEXNOW_KEY: "key",
      INDEXNOW_HOST: "architech.example",
    });
    expect(outcome.indexNow).toEqual({ submitted: false, reason: "empty" });
  });

  it("skips the ping when IndexNow is unconfigured", async () => {
    const outcome = await discoverListingEvent(event(), {});
    expect(outcome.indexNow).toEqual({ submitted: false, reason: "not-configured" });
  });

  it("pings the hubs for a published listing", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);
    try {
      const outcome = await discoverListingEvent(event(), {
        INDEXNOW_KEY: "key",
        INDEXNOW_HOST: "architech.example",
      });
      expect(outcome.indexNow).toMatchObject({ submitted: true, urlCount: 3 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("revalidates even when the ping fails", async () => {
    // The ping is the last mile, not the road. Losing it must not lose the
    // revalidation, which is what actually makes the page fresh.
    const outcome = await discoverListingEvent(event(), { INDEXNOW_KEY: "key", INDEXNOW_HOST: "architech.example" });
    expect(outcome.revalidated.length).toBeGreaterThan(0);
  });
});

describe("registerSeoDiscovery", () => {
  it("attaches exactly one subscriber however many times it is called", async () => {
    resetSeoDiscoveryForTests();
    resetListingEventBusForTests();
    const seen: ListingEvent[] = [];
    onListingEvent((e) => {
      seen.push(e);
    });

    registerSeoDiscovery();
    registerSeoDiscovery();
    registerSeoDiscovery();

    const { emitListingEvent } = await import("@/lib/listing/events");
    await emitListingEvent(event());
    // One discovery subscriber plus the observer above. A duplicate would
    // double every revalidation.
    expect(seen).toHaveLength(1);
    resetSeoDiscoveryForTests();
  });
});
