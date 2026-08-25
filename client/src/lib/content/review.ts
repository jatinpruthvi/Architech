/* Guide/content editorial approval workflow.
   Models the gates that must pass before a guide (or future content system)
   moves from `editorial-review` to `published` for indexing. A guide is only
   publishable when it has (a) a named reviewer, (b) at least one auditable
   source, (c) a non-empty body, and (d) an explicit approval from that reviewer.

   Deterministic and server-safe; used by the guide route's indexability gate and
   by CI to prevent accidental publication of unreviewed content. */

import type { Guide } from "@/lib/repositories";

export type GuideReviewState = "draft" | "editorial-review" | "approved" | "published";

export type ReviewGate = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type ReviewDecision = {
  state: GuideReviewState;
  passed: boolean;
  gates: ReviewGate[];
  reasons: string[];
};

/** Evaluate the editorial gates for a guide. */
export function evaluateGuideGates(guide: Pick<Guide, "reviewer" | "sources" | "sections" | "status"> & { reviewerApproved?: boolean }): ReviewDecision {
  const gates: ReviewGate[] = [];
  const reviewerName = guide.reviewer?.trim() ?? "";
  const hasRealReviewer = guide.reviewerApproved === true && reviewerName.length > 0 && !reviewerName.toLowerCase().includes("pending");
  gates.push({
    id: "reviewer_assigned",
    label: "Named reviewer assigned",
    passed: reviewerName.length > 0 && !reviewerName.toLowerCase().includes("pending"),
    detail: reviewerName.length > 0 && !reviewerName.toLowerCase().includes("pending") ? `Reviewer: ${reviewerName}` : "No named reviewer (or reviewer pending).",
  });
  gates.push({
    id: "sources_auditable",
    label: "At least one auditable source",
    passed: Array.isArray(guide.sources) && guide.sources.length > 0 && guide.sources.every((source) => source.label.trim().length > 0),
    detail: Array.isArray(guide.sources) && guide.sources.length > 0 ? `${guide.sources.length} source(s) on file` : "No sources on file.",
  });
  gates.push({
    id: "body_present",
    label: "Content body present",
    passed: Array.isArray(guide.sections) && guide.sections.length > 0 && guide.sections.some((section) => section.body.trim().length >= 80),
    detail: Array.isArray(guide.sections) && guide.sections.length > 0 ? `${guide.sections.length} section(s)` : "Empty body.",
  });
  gates.push({
    id: "reviewer_approved",
    label: "Reviewer approval recorded",
    passed: hasRealReviewer,
    detail: hasRealReviewer ? "Reviewer approval recorded." : "No explicit approval recorded.",
  });

  const passed = gates.every((gate) => gate.passed);
  const state: GuideReviewState = passed ? "approved" : "editorial-review";
  const reasons = gates.filter((gate) => !gate.passed).map((gate) => `Missing: ${gate.label}`);
  return { state, passed, gates, reasons };
}

/** Whether a guide is ready to be published / indexed. */
export function isGuidePublishable(guide: Pick<Guide, "reviewer" | "sources" | "sections" | "status"> & { reviewerApproved?: boolean }): boolean {
  return evaluateGuideGates(guide).passed;
}

/** Whether a guide should be marked noindex (i.e. not publishable). */
export function guideIndexability(guide: Pick<Guide, "reviewer" | "sources" | "sections" | "status"> & { reviewerApproved?: boolean }): "indexable" | "noindex" {
  return isGuidePublishable(guide) ? "indexable" : "noindex";
}

export function countPendingGates(guide: Pick<Guide, "reviewer" | "sources" | "sections" | "status"> & { reviewerApproved?: boolean }): number {
  return evaluateGuideGates(guide).reasons.length;
}
