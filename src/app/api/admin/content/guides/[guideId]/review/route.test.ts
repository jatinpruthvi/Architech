import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { resetGuideReviewRecords } from "@/lib/persistence/guide-review-store";

/* Contract of the guide editorial approval endpoint, asserted as behaviour
   rather than intent (same rationale as the acquisition route test: "internal
   only" is a claim a comment cannot enforce). The endpoint must refuse
   anonymous callers, validate the action vocabulary, fail closed for unknown
   guides, and let the workflow — not the caller — decide what is approvable. */

const base = "http://example.com/api/admin/content/guides/verify-rera/review";

function post(body: Record<string, unknown>, url = base) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetGuideReviewRecords();
});

describe("POST /api/admin/content/guides/[guideId]/review", () => {
  it("refuses an anonymous request", async () => {
    /* `mode=none` forces no session, the same knob the acquisition route test
       uses — without it the demo contract hands out the default broker-admin
       session, which is authorized. */
    const response = await POST(post({ action: "submit" }, `${base}?mode=none`), { params: Promise.resolve({ guideId: "verify-rera" }) });
    expect(response.status).toBe(401);
  });

  it("rejects an unknown action with 400", async () => {
    const response = await POST(post({ action: "explode" }), { params: Promise.resolve({ guideId: "verify-rera" }) });
    expect(response.status).toBe(400);
  });

  it("fails closed for an unknown guide with 404", async () => {
    const response = await POST(post({ action: "submit" }), { params: Promise.resolve({ guideId: "does-not-exist" }) });
    expect(response.status).toBe(404);
  });

  it("submits a guide into editorial review", async () => {
    const response = await POST(post({ action: "submit" }), { params: Promise.resolve({ guideId: "verify-rera" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("editorial-review");
    expect(body.events).toHaveLength(1);
    expect(body.events[0].action).toBe("submit");
  });

  it("refuses to approve a guide whose editorial gates have not passed", async () => {
    await POST(post({ action: "submit" }), { params: Promise.resolve({ guideId: "verify-rera" }) });
    const response = await POST(post({ action: "approve" }), { params: Promise.resolve({ guideId: "verify-rera" }) });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  it("is never cached", async () => {
    const response = await POST(post({ action: "submit" }), { params: Promise.resolve({ guideId: "verify-rera" }) });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
