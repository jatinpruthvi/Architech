/* Guide editorial approval workflow (P1-CONT-001 remaining code half).

   `review.ts` evaluates the gates that decide whether a guide MAY publish;
   this module models the workflow that decides HOW it moves between states and
   records who did it and when. Separation matters: a gate is a static check,
   an approval is an accountable human act with an audit trail.

   Deterministic and server-safe: actor and timestamp are passed in, never
   derived from the wall clock, so a review decision is reproducible and its
   audit event is an argument to the function rather than a side effect. */

import { evaluateGuideGates } from "./review";
import type { Guide } from "@/lib/repositories";

export type GuideWorkflowStatus =
  | "draft"
  | "editorial-review"
  | "approved"
  | "published"
  | "changes-requested"
  | "rejected";

export type GuideReviewAction = "submit" | "approve" | "publish" | "request_changes" | "reject";

export type GuideReviewEvent = {
  action: GuideReviewAction;
  from: GuideWorkflowStatus;
  to: GuideWorkflowStatus;
  actorId: string;
  at: string;
  reason?: string;
};

export type GuideReviewRecord = {
  guideId: string;
  status: GuideWorkflowStatus;
  events: GuideReviewEvent[];
};

type StepResult = { ok: true; next: GuideWorkflowStatus } | { ok: false; error: string };

/** The legal transitions only — a bare state machine with no gate logic. */
export function nextGuideStatus(current: GuideWorkflowStatus, action: GuideReviewAction): StepResult {
  switch (action) {
    case "submit":
      return current === "draft" || current === "changes-requested" || current === "rejected"
        ? { ok: true, next: "editorial-review" }
        : { ok: false, error: `Cannot submit a guide that is already ${current}.` };
    case "approve":
      return current === "editorial-review"
        ? { ok: true, next: "approved" }
        : { ok: false, error: `Cannot approve a guide that is ${current}; it must be in editorial review.` };
    case "publish":
      return current === "approved"
        ? { ok: true, next: "published" }
        : { ok: false, error: `Cannot publish a guide that is ${current}; publish requires a prior approval.` };
    case "request_changes":
      return current === "editorial-review"
        ? { ok: true, next: "changes-requested" }
        : { ok: false, error: `Cannot request changes on a guide that is ${current}.` };
    case "reject":
      return current === "editorial-review"
        ? { ok: true, next: "rejected" }
        : { ok: false, error: `Cannot reject a guide that is ${current}.` };
    default:
      return { ok: false, error: `Unknown review action.` };
  }
}

export type ReviewActionOptions = {
  actorId: string;
  at: string;
  reason?: string;
  /** Whether `evaluateGuideGates` passed at this moment; required for approve. */
  gatePassed?: boolean;
};

export type AppliedAction =
  | { ok: true; next: GuideWorkflowStatus; events: GuideReviewEvent[] }
  | { ok: false; error: string };

/** One transition, with the action-specific preconditions on top of the state
    machine. Returns the transition's audit event rather than mutating state. */
export function applyGuideReviewAction(
  current: GuideWorkflowStatus,
  action: GuideReviewAction,
  options: ReviewActionOptions,
): AppliedAction {
  if (action === "approve" && options.gatePassed !== true) {
    return { ok: false, error: "approve requires every editorial gate to pass (named reviewer approval, auditable sources, content body)." };
  }
  if ((action === "request_changes" || action === "reject") && !(options.reason ?? "").trim()) {
    return { ok: false, error: `${action} requires a reason for the author.` };
  }
  const step = nextGuideStatus(current, action);
  if (!step.ok) return step;
  const event: GuideReviewEvent = {
    action,
    from: current,
    to: step.next,
    actorId: options.actorId,
    at: options.at,
    ...(options.reason?.trim() ? { reason: options.reason.trim() } : {}),
  };
  return { ok: true, next: step.next, events: [event] };
}

/** Apply a review action to a guide's record, returning the new record with the
    event appended. The gate is evaluated fresh on approve, so an approval can
    never be recorded against a guide whose body/sources/reviewer have since
    been weakened. */
export function reviewGuide(
  guide: { id: string } & Pick<Guide, "reviewer" | "sources" | "sections" | "status"> & { reviewerApproved?: boolean },
  record: GuideReviewRecord | undefined,
  action: GuideReviewAction,
  actorId: string,
  at: string,
  reason?: string,
): { ok: true; record: GuideReviewRecord } | { ok: false; error: string } {
  const current: GuideWorkflowStatus = record?.status ?? "draft";
  const gatePassed = action === "approve" ? evaluateGuideGates(guide).passed : undefined;
  const result = applyGuideReviewAction(current, action, { actorId, at, reason, gatePassed });
  if (!result.ok) return result;
  const base = record ?? { guideId: guide.id, status: "draft" as GuideWorkflowStatus, events: [] as GuideReviewEvent[] };
  return { ok: true, record: { ...base, status: result.next, events: [...base.events, ...result.events] } };
}
