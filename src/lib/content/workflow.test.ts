import { describe, expect, it } from "vitest";
import { applyGuideReviewAction, nextGuideStatus, reviewGuide, type GuideReviewAction } from "./workflow";
import type { Guide } from "@/lib/repositories";

/* Editorial approval workflow (P1-CONT-001 remaining code half).

   The gates in `review.ts` decide whether a guide MAY publish; this workflow
   decides HOW it moves between states, and records who did it and when. The
   two are separate on purpose: a gate is a static check, an approval is an
   accountable human act with an audit trail. */

const ACTOR = "reviewer-1";
const AT = "2026-08-30T10:00:00.000Z";

const passableGuide: Pick<Guide, "id" | "status" | "reviewer" | "sources" | "sections"> & { reviewerApproved?: boolean } = {
  id: "verify-rera",
  status: "editorial-review",
  reviewer: "Legal + Data reviewer",
  reviewerApproved: true,
  sources: [{ label: "Gujarat RERA public registry", note: "Official source." }],
  sections: [{ heading: "Method", body: "A plain-language method for checking registration numbers against an approved source record." }],
};

describe("nextGuideStatus", () => {
  it.each([
    ["submit", "draft", "editorial-review"],
    ["submit", "changes-requested", "editorial-review"],
    ["submit", "rejected", "editorial-review"],
    ["approve", "editorial-review", "approved"],
    ["publish", "approved", "published"],
    ["request_changes", "editorial-review", "changes-requested"],
    ["reject", "editorial-review", "rejected"],
  ] as const)("%s from %s moves to %s", (action, current, next) => {
    const step = nextGuideStatus(current, action);
    expect(step.ok).toBe(true);
    if (step.ok) expect(step.next).toBe(next);
  });

  it.each([
    ["approve", "draft"],
    ["approve", "approved"],
    ["approve", "published"],
    ["publish", "editorial-review"],
    ["publish", "draft"],
    ["request_changes", "published"],
    ["reject", "published"],
    ["submit", "editorial-review"],
    ["submit", "published"],
  ] as const)("rejects the illegal transition %s from %s", (action, current) => {
    const step = nextGuideStatus(current, action);
    expect(step.ok).toBe(false);
  });
});

describe("applyGuideReviewAction", () => {
  it("approve requires every editorial gate to pass", () => {
    const gated = applyGuideReviewAction("editorial-review", "approve", { actorId: ACTOR, at: AT, gatePassed: false });
    expect(gated.ok).toBe(false);
    if (!gated.ok) expect(gated.error).toMatch(/gate/i);
  });

  it("approve records the reviewer and a from→to audit event", () => {
    const result = applyGuideReviewAction("editorial-review", "approve", { actorId: ACTOR, at: AT, gatePassed: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.next).toBe("approved");
      expect(result.events).toEqual([{ action: "approve", from: "editorial-review", to: "approved", actorId: ACTOR, at: AT }]);
    }
  });

  it("request_changes and reject require a reason", () => {
    for (const action of ["request_changes", "reject"] as const) {
      const result = applyGuideReviewAction("editorial-review", action, { actorId: ACTOR, at: AT });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/reason/i);
    }
  });

  it("rejects an unknown action", () => {
    const result = applyGuideReviewAction("draft", "explode" as GuideReviewAction, { actorId: ACTOR, at: AT });
    expect(result.ok).toBe(false);
  });
});

describe("reviewGuide", () => {
  it("carries a guide from draft through approval to published with a full audit trail", () => {
    const submitted = reviewGuide(passableGuide, undefined, "submit", ACTOR, AT);
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.record.status).toBe("editorial-review");

    const approved = reviewGuide(passableGuide, submitted.record, "approve", ACTOR, AT);
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.record.status).toBe("approved");

    const published = reviewGuide(passableGuide, approved.record, "publish", ACTOR, AT);
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(published.record.status).toBe("published");
    expect(published.record.events.map((event) => event.action)).toEqual(["submit", "approve", "publish"]);
    expect(published.record.events.every((event) => event.actorId === ACTOR && event.at === AT)).toBe(true);
  });

  it("will not approve a guide whose gates fail", () => {
    const broken = { ...passableGuide, reviewerApproved: false, reviewer: "Reviewer pending" };
    const submitted = reviewGuide(broken, undefined, "submit", ACTOR, AT);
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const approved = reviewGuide(broken, submitted.record, "approve", ACTOR, AT);
    expect(approved.ok).toBe(false);
  });

  it("cannot publish a guide that was never approved", () => {
    const submitted = reviewGuide(passableGuide, undefined, "submit", ACTOR, AT);
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const published = reviewGuide(passableGuide, submitted.record, "publish", ACTOR, AT);
    expect(published.ok).toBe(false);
  });
});
