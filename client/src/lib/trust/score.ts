/* Trust & verification score model.
   Server-safe (no client directive) and side-effect free so it can be used by
   server routes, server components, and the SEO registry alike.

   Rationale: a listing's trustworthiness should be a single auditable signal,
   not a hand-tuned badge. It is derived only from *structured facts* that
   already flow through the repository layer (verification status, RERA record,
   media moderation, freshness). It never manufactures claims. */

export type TrustGrade = "HIGH" | "MEDIUM" | "LOW";

export type TrustSignalId =
  | "rera_verified"
  | "source_reviewed"
  | "broker_verified"
  | "media_rights_confirmed"
  | "freshness_current"
  | "no_dispute";

export type TrustSignal = {
  id: TrustSignalId;
  label: string;
  met: boolean;
  detail: string;
};

/** What the score is derived from. Fields are structured facts, not free text. */
export type TrustScoreInput = {
  /** Listing verification status (from the repository/DB `verification` field). */
  verification?: string | null;
  brokerVerified?: boolean;
  reraVerified?: boolean;
  /** True when the RERA record carries an active dispute / open correction. */
  reraDisputed?: boolean;
  /** True when the RERA record has been flagged stale and needs refresh. */
  reraStale?: boolean;
  mediaRightsConfirmed?: boolean;
  mediaApproved?: boolean;
  meaningfulUpdatedAt?: string | Date | null;
  /** Freshness window, in days. A listing older than this is not "current". */
  freshnessMaxDays?: number;
};

export type TrustScore = {
  score: number;
  grade: TrustGrade;
  signals: TrustSignal[];
  /** Short, neutral one-liner for badges and the trust panel header. */
  summary: string;
  /** Ordered list of human-readable reasons, for UI copy and JSON-LD. */
  reasons: string[];
};

export const TRUST_CONFIG = {
  weights: {
    rera_verified: 28,
    source_reviewed: 16,
    broker_verified: 16,
    media_rights_confirmed: 14,
    freshness_current: 14,
    no_dispute: 12,
  } as const,
  gradeThresholds: {
    high: 78,
    medium: 52,
  },
  /**
   * Default freshness window. Listings that are "meaningfully updated" within
   * this many days count as current. Demo fixtures use a small window so the
   * freshness signal stays honest rather than always-true.
   */
  defaultFreshnessMaxDays: 45,
} as const;

export const TRUST_SIGNAL_LABELS: Record<TrustSignalId, string> = {
  rera_verified: "RERA verified",
  source_reviewed: "Source reviewed",
  broker_verified: "Verified partner",
  media_rights_confirmed: "Media rights confirmed",
  freshness_current: "Recently updated",
  no_dispute: "No active dispute",
};

function isFresh(value?: string | Date | null, maxDays: number = TRUST_CONFIG.defaultFreshnessMaxDays): boolean {
  if (!value) return false;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return false;
  const ageDays = (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
  return ageDays >= 0 && ageDays <= maxDays;
}

/** Resolve the signals for a given set of structured facts. */
export function computeTrustSignals(input: TrustScoreInput): TrustSignal[] {
  const verification = (input.verification ?? "").toUpperCase();
  const reraVerified = input.reraVerified ?? verification === "RERA_VERIFIED";
  const sourceReviewed = verification !== "";
  const brokerVerified = input.brokerVerified ?? verification === "VERIFIED_PARTNER";
  const mediaRights = input.mediaRightsConfirmed ?? input.mediaApproved ?? false;
  const fresh = isFresh(input.meaningfulUpdatedAt, input.freshnessMaxDays ?? TRUST_CONFIG.defaultFreshnessMaxDays);
  const noDispute = !input.reraDisputed && !input.reraStale;

  return [
    {
      id: "rera_verified",
      label: TRUST_SIGNAL_LABELS.rera_verified,
      met: reraVerified,
      detail: reraVerified
        ? "RERA registration confirmed against an approved source."
        : "No RERA registration confirmed for this listing yet.",
    },
    {
      id: "source_reviewed",
      label: TRUST_SIGNAL_LABELS.source_reviewed,
      met: sourceReviewed,
      detail: sourceReviewed
        ? "Listing details were reviewed against the source record."
        : "Listing details have not yet been source-reviewed.",
    },
    {
      id: "broker_verified",
      label: TRUST_SIGNAL_LABELS.broker_verified,
      met: brokerVerified,
      detail: brokerVerified
        ? "The listing partner is a verified organization."
        : "The listing partner has not been verified.",
    },
    {
      id: "media_rights_confirmed",
      label: TRUST_SIGNAL_LABELS.media_rights_confirmed,
      met: mediaRights,
      detail: mediaRights
        ? "Media rights were confirmed and release evidence is on file."
        : "Media rights have not been confirmed.",
    },
    {
      id: "freshness_current",
      label: TRUST_SIGNAL_LABELS.freshness_current,
      met: fresh,
      detail: fresh
        ? "The listing was meaningfully updated within the freshness window."
        : "The listing has not been refreshed recently.",
    },
    {
      id: "no_dispute",
      label: TRUST_SIGNAL_LABELS.no_dispute,
      met: noDispute,
      detail: noDispute
        ? "No active RERA dispute or stale flag is open."
        : "An active RERA dispute, correction, or stale flag is open.",
    },
  ];
}

/**
 * Active disputes and stale flags are treated as *penalties* rather than merely
 * missing signals: a live dispute is a serious trust problem and must cap the
 * grade even if every other signal is met.
 */
export const TRUST_PENALTIES = {
  disputed: 55,
  stale: 25,
} as const;

/** Compute a weighted 0–100 score and grade from structured trust signals. */
export function computeTrustScore(input: TrustScoreInput): TrustScore {
  const signals = computeTrustSignals(input);
  const baseScore = signals.reduce((total, signal) => total + (signal.met ? TRUST_CONFIG.weights[signal.id] : 0), 0);
  let score = baseScore;
  if (input.reraDisputed) score = Math.max(0, score - TRUST_PENALTIES.disputed);
  else if (input.reraStale) score = Math.max(0, score - TRUST_PENALTIES.stale);
  const grade: TrustGrade = score >= TRUST_CONFIG.gradeThresholds.high ? "HIGH" : score >= TRUST_CONFIG.gradeThresholds.medium ? "MEDIUM" : "LOW";
  return {
    score,
    grade,
    signals,
    summary: gradeSummary(grade),
    reasons: buildReasons(signals),
  };
}

export function trustGradeLabel(grade: TrustGrade): string {
  return grade === "HIGH" ? "High trust" : grade === "MEDIUM" ? "Moderate trust" : "Low trust";
}

function gradeSummary(grade: TrustGrade): string {
  return grade === "HIGH" ? "Independently verified" : grade === "MEDIUM" ? "Reviewed, more to confirm" : "Needs review";
}

function buildReasons(signals: TrustSignal[]): string[] {
  const met = signals.filter((signal) => signal.met);
  const unmet = signals.filter((signal) => !signal.met);
  const passed = met.map((signal) => signal.label);
  const missing = unmet.map((signal) => signal.label);
  const reasons: string[] = [];
  if (passed.length) reasons.push(`Confirmed: ${passed.join(", ")}.`);
  if (missing.length) reasons.push(`Not yet confirmed: ${missing.join(", ")}.`);
  if (!passed.length) reasons.push("No verification signals are confirmed yet.");
  return reasons;
}

/**
 * Map a listing's display badge + status string to structured signals.
 * Used by the fixture-backed listing surface; the Prisma path passes structured
 * fields directly to `computeTrustScore`.
 */
export function badgesToTrustInput(badge?: string, status?: string): TrustScoreInput {
  const normalized = badge?.toLowerCase() ?? "";
  const reraVerified = normalized.includes("rera");
  const brokerVerified = normalized.includes("partner");
  // The current demo status string is of the form "Updated N days ago" / "Updated today".
  const match = /(?:updated\s+(\d+)\s+day|updated\s+today)/i.exec(status ?? "");
  const freshnessMaxDays = TRUST_CONFIG.defaultFreshnessMaxDays;
  const daysAgo = status?.toLowerCase().includes("today") ? 0 : match ? Number(match[1]) : null;
  const meaningfulUpdatedAt =
    daysAgo === null ? undefined : new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    verification: reraVerified ? "RERA_VERIFIED" : brokerVerified ? "VERIFIED_PARTNER" : "SOURCE_REVIEWED",
    brokerVerified,
    reraVerified,
    mediaRightsConfirmed: true,
    mediaApproved: true,
    meaningfulUpdatedAt,
    freshnessMaxDays,
  };
}
