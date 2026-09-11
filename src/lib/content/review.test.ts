import { describe, expect, it } from "vitest";
import { countPendingGates, evaluateGuideGates, guideIndexability, isGuidePublishable } from "./review";
import { getGuides } from "@/lib/repositories";

function reviewedGuide(overrides: Record<string, unknown> = {}) {
  return {
    reviewer: "Legal + Data reviewer",
    reviewerApproved: true,
    sources: [{ label: "Gujarat RERA public registry", note: "Official source." }],
    sections: [{ heading: "Method", body: "A plain-language method for checking registration numbers against an approved source." }],
    status: "editorial-review",
    ...overrides,
  } as Parameters<typeof evaluateGuideGates>[0];
}

describe("guide editorial approval workflow", () => {
  it("passes when all gates are met", () => {
    const decision = evaluateGuideGates(reviewedGuide());
    expect(decision.passed).toBe(true);
    expect(decision.state).toBe("approved");
    expect(isGuidePublishable(reviewedGuide())).toBe(true);
  });

  it("fails when reviewer approval is not recorded", () => {
    const decision = evaluateGuideGates(reviewedGuide({ reviewerApproved: false, reviewer: "Reviewer pending" }));
    expect(decision.passed).toBe(false);
    expect(decision.state).toBe("editorial-review");
    expect(decision.reasons).toContain("Missing: Reviewer approval recorded");
  });

  it("fails when there are no auditable sources", () => {
    const decision = evaluateGuideGates(reviewedGuide({ sources: [] }));
    expect(decision.passed).toBe(false);
    expect(decision.reasons).toContain("Missing: At least one auditable source");
  });

  it("keeps the demo guides noindex until gates pass", () => {
    for (const guide of getGuides()) {
      expect(guideIndexability(guide)).toBe("noindex");
    }
  });

  it("counts pending gates for a broken guide", () => {
    expect(countPendingGates(reviewedGuide({ sources: [], reviewerApproved: false }))).toBeGreaterThanOrEqual(2);
  });
});
