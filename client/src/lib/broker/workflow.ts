import { demoBrokerSession, requirePermission, type AuthSession } from "@/lib/auth/roles";
import { getLocalityBySlug } from "@/lib/repositories";

export type BrokerProfileInput = {
  organizationName: string;
  legalName?: string;
  reraNumber?: string;
  email: string;
  phoneMasked?: string;
  citySlug: string;
  consentText: string;
};

export type ListingDraftInput = {
  organizationId?: string;
  title: string;
  localitySlug: string;
  priceInr: number;
  bhk: number;
  areaSqft: number;
  availability: string;
  description: string;
  reraNumber?: string;
  mediaRightsConfirmed: boolean;
};

export type ModerationDecision = "approve" | "request_changes" | "reject";
export type DraftStatus = "DRAFT" | "IN_REVIEW" | "ACTIVE" | "CHANGES_REQUESTED" | "REJECTED";

export type ListingDraft = ListingDraftInput & {
  id: string;
  stableId: string;
  organizationId: string;
  status: DraftStatus;
  auditTrail: AuditItem[];
  createdAt: string;
  updatedAt: string;
};

export type AuditItem = {
  id: string;
  action: string;
  actor: string;
  at: string;
  metadata?: Record<string, unknown>;
};

const drafts = new Map<string, ListingDraft>();

function stableId(prefix: string, seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${prefix}_${hash.toString(36)}`;
}

function audit(action: string, actor: string, metadata?: Record<string, unknown>): AuditItem {
  return { id: stableId("audit", `${action}:${actor}:${Date.now()}:${Math.random()}`), action, actor, at: new Date().toISOString(), metadata };
}

export function validateBrokerProfile(input: Partial<BrokerProfileInput>): string[] {
  const errors: string[] = [];
  if (!input.organizationName || input.organizationName.trim().length < 2) errors.push("Organization name is required.");
  if (!input.email || !/^\S+@\S+\.\S+$/.test(input.email)) errors.push("Valid organization email is required.");
  if (!input.citySlug || input.citySlug !== "ahmedabad") errors.push("Phase 1 broker onboarding is Ahmedabad-only.");
  if (!input.consentText || input.consentText.length < 12) errors.push("Consent and media-rights acknowledgement is required.");
  return errors;
}

export function validateListingDraft(input: Partial<ListingDraftInput>, session: AuthSession | null = demoBrokerSession): string[] {
  const errors: string[] = [];
  if (!session || !requirePermission(session, "listing.draft.create")) errors.push("Broker listing permission is required.");
  if (!input.title || input.title.trim().length < 8) errors.push("Listing title must be at least 8 characters.");
  if (!input.localitySlug || !getLocalityBySlug(input.localitySlug)) errors.push("Choose a valid Ahmedabad locality.");
  if (!Number.isFinite(input.priceInr) || Number(input.priceInr) <= 0) errors.push("Price must be a positive INR value.");
  if (!Number.isFinite(input.bhk) || Number(input.bhk) < 1) errors.push("BHK must be at least 1.");
  if (!Number.isFinite(input.areaSqft) || Number(input.areaSqft) < 150) errors.push("Area must be at least 150 sq ft.");
  if (!input.availability || input.availability.trim().length < 3) errors.push("Availability/status is required.");
  if (!input.description || input.description.trim().length < 30) errors.push("Description must be at least 30 characters.");
  if (!input.mediaRightsConfirmed) errors.push("Media rights confirmation is required before review.");
  return errors;
}

export function createListingDraft(input: ListingDraftInput, session: AuthSession | null = demoBrokerSession) {
  const errors = validateListingDraft(input, session);
  if (errors.length) return { ok: false as const, status: 400, errors };

  const now = new Date().toISOString();
  const seed = `${session!.organization!.id}:${input.title}:${input.localitySlug}`;
  const id = stableId("draft", seed);
  const draft: ListingDraft = {
    ...input,
    id,
    stableId: stableId("listing", seed),
    organizationId: session!.organization!.id,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    auditTrail: [audit("listing.draft.created", session!.user.email, { localitySlug: input.localitySlug })],
  };
  drafts.set(id, draft);
  return { ok: true as const, draft };
}

export function submitListingForReview(draftId: string, session: AuthSession | null = demoBrokerSession) {
  const draft = drafts.get(draftId);
  if (!draft) return { ok: false as const, status: 404, errors: ["Draft not found."] };
  if (!session || draft.organizationId !== session.organization?.id) return { ok: false as const, status: 403, errors: ["Organization mismatch."] };
  draft.status = "IN_REVIEW";
  draft.updatedAt = new Date().toISOString();
  draft.auditTrail.push(audit("listing.review.submitted", session.user.email));
  return { ok: true as const, draft };
}

export function moderateListing(draftId: string, decision: ModerationDecision, reason: string, session: AuthSession | null = { ...demoBrokerSession, user: { ...demoBrokerSession.user, role: "MODERATOR" }, permissions: ["listing.review.moderate"] }) {
  const draft = drafts.get(draftId);
  if (!draft) return { ok: false as const, status: 404, errors: ["Draft not found."] };
  if (!session || !requirePermission(session, "listing.review.moderate")) return { ok: false as const, status: 403, errors: ["Moderation permission is required."] };

  draft.status = decision === "approve" ? "ACTIVE" : decision === "request_changes" ? "CHANGES_REQUESTED" : "REJECTED";
  draft.updatedAt = new Date().toISOString();
  draft.auditTrail.push(audit(`listing.review.${decision}`, session.user.email, { reason }));
  return { ok: true as const, draft };
}

export function getModerationQueue() {
  return [...drafts.values()].filter((draft) => draft.status === "IN_REVIEW");
}

/** A broker's own drafts, newest-edit-first. Excludes nothing (all statuses). */
export function listBrokerDrafts(organizationId: string) {
  return [...drafts.values()]
    .filter((draft) => draft.organizationId === organizationId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Per-draft attached media ids (memory store; a real contract until media is
    persisted to a durable store alongside the listing). */
const draftMedia = new Map<string, Set<string>>();

/** Attach a media id to a draft; requires the draft to exist. */
export function attachMediaToDraft(draftId: string, mediaId: string, session: AuthSession | null = demoBrokerSession): { ok: true; mediaIds: string[] } | { ok: false; status: number; errors: string[] } {
  const draft = drafts.get(draftId);
  if (!draft) return { ok: false, status: 404, errors: ["Draft not found."] };
  if (!session || draft.organizationId !== session.organization?.id) return { ok: false, status: 403, errors: ["Organization mismatch."] };
  const current = draftMedia.get(draftId) ?? new Set<string>();
  current.add(mediaId);
  draftMedia.set(draftId, current);
  return { ok: true, mediaIds: [...current] };
}

/** Detach a media id from a draft. */
export function detachMediaFromDraft(draftId: string, mediaId: string, session: AuthSession | null = demoBrokerSession): { ok: true; mediaIds: string[] } | { ok: false; status: number; errors: string[] } {
  const draft = drafts.get(draftId);
  if (!draft) return { ok: false, status: 404, errors: ["Draft not found."] };
  if (!session || draft.organizationId !== session.organization?.id) return { ok: false, status: 403, errors: ["Organization mismatch."] };
  const current = draftMedia.get(draftId) ?? new Set<string>();
  current.delete(mediaId);
  return { ok: true, mediaIds: [...current] };
}

/** List media ids attached to a draft. */
export function listDraftMediaIds(draftId: string, session: AuthSession | null = demoBrokerSession): string[] {
  const draft = drafts.get(draftId);
  if (!draft || !session || draft.organizationId !== session.organization?.id) return [];
  return [...(draftMedia.get(draftId) ?? [])];
}

export function resetBrokerWorkflowForTests() {
  drafts.clear();
  draftMedia.clear();
}
