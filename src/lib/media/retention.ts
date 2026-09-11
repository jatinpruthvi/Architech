/* Media retention, takedown & EXIF policy (P1-MEDIA-001 / P1-DATA-002).
   Deterministic, server-safe module that defines how long media is kept, when
   it must be taken down, and the EXIF-strip requirement before publication. Used
   by the media pipeline and by CI to enforce deletion/retention rules. */

export type MediaModerationStatus = "PENDING" | "APPROVED" | "REJECTED" | "TAKEDOWN_REQUESTED" | "DELETED";

export type RetentionPolicy = {
  id: string;
  label: string;
  /** Retention in days from creation/last-activity. */
  retentionDays: number;
  /** Takedown is required after this many days if still in the given state. */
  takedownAfterDays: number;
  /** Applies only to media in these moderation states. */
  states: MediaModerationStatus[];
};

export const RETENTION_POLICIES: RetentionPolicy[] = [
  {
    id: "pending_review",
    label: "Media pending moderation is only kept temporarily.",
    retentionDays: 30,
    takedownAfterDays: 30,
    states: ["PENDING"],
  },
  {
    id: "rejected",
    label: "Rejected media is removed after a short retention window.",
    retentionDays: 14,
    takedownAfterDays: 14,
    states: ["REJECTED"],
  },
  {
    id: "approved",
    label: "Approved media is retained while the listing is live.",
    retentionDays: 3650,
    takedownAfterDays: 0,
    states: ["APPROVED"],
  },
  {
    id: "takedown_requested",
    label: "Takedown-requested media is removed immediately after a holding period.",
    retentionDays: 7,
    takedownAfterDays: 7,
    states: ["TAKEDOWN_REQUESTED"],
  },
];

export type RetentionDecision = {
  act: "retain" | "takedown" | "delete";
  reason: string;
  policyId?: string;
};

/** Whether a file that was flagged for EXIF removal is publishable. */
export function isExifCleared(exifStripped: boolean): boolean {
  return exifStripped === true;
}

/** Decide what to do with media given its state and age. */
export function decideMediaRetention(state: MediaModerationStatus, ageDays: number): RetentionDecision {
  const policy = RETENTION_POLICIES.find((candidate) => candidate.states.includes(state));
  if (!policy) return { act: "retain", reason: `No retention policy for ${state}.` };

  if (state === "TAKEDOWN_REQUESTED" && ageDays >= policy.takedownAfterDays) {
    return { act: "delete", reason: `Takedown confirmed after holding ${policy.takedownAfterDays} days.`, policyId: policy.id };
  }
  if (ageDays >= policy.retentionDays) {
    // Approved media is generally retained; only non-approved states are auto-removed.
    if (state !== "APPROVED") return { act: "takedown", reason: `Exceeded ${policy.retentionDays}-day retention for ${state.toLowerCase()} media.`, policyId: policy.id };
    return { act: "retain", reason: "Approved media retained while listing is live.", policyId: policy.id };
  }
  return { act: "retain", reason: `Within ${policy.retentionDays}-day retention window.`, policyId: policy.id };
}

/** Validate that a media record can be published (approved + EXIF stripped). */
export function isPublishable(media: { moderationStatus: MediaModerationStatus; exifStripped: boolean }): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (media.moderationStatus !== "APPROVED") reasons.push("Media must be approved before publication.");
  if (media.moderationStatus === "APPROVED" && !isExifCleared(media.exifStripped)) reasons.push("Location/EXIF metadata must be stripped before publication.");
  return { ok: reasons.length === 0, reasons };
}
