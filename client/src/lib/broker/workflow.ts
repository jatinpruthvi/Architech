import { demoBrokerSession, requirePermission, type AuthSession } from "@/lib/auth/roles";
import { getLiveCityBySlug, getLocalityBySlug } from "@/lib/repositories";
import type { PropertyDetails } from "@/lib/listing-details";
import { isAvailabilityCode, isPropertyTypeCode, type AvailabilityCode, type PropertyTypeCode } from "@/lib/listing-vocabulary";
import { isValidPincode, listingMatchesPincode } from "@/lib/pincodes";

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
  /** Explicit city scope; locality and PIN are validated inside this city. */
  citySlug: string;
  localitySlug: string;
  /** Six-digit India Post PIN linked to the selected locality. */
  postalCode: string;
  priceInr: number;
  bhk: number;
  areaSqft: number;
  propertyType: PropertyTypeCode;
  availability: AvailabilityCode;
  description: string;
  reraNumber?: string;
  mediaRightsConfirmed: boolean;
  details?: PropertyDetails;
};

export type ModerationDecision = "approve" | "request_changes" | "reject";
export type DraftStatus = "DRAFT" | "IN_REVIEW" | "ACTIVE" | "CHANGES_REQUESTED" | "REJECTED" | "ARCHIVED" | "DUPLICATE";

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
  if (!input.citySlug || !getLiveCityBySlug(input.citySlug)) errors.push("Choose a city Architech currently covers.");
  if (!input.consentText || input.consentText.length < 12) errors.push("Consent and media-rights acknowledgement is required.");
  return errors;
}

export function validateListingDraft(input: Partial<ListingDraftInput>, session: AuthSession | null = demoBrokerSession): string[] {
  const errors: string[] = [];
  if (!session || !requirePermission(session, "listing.draft.create")) errors.push("Broker listing permission is required.");
  if (!input.title || input.title.trim().length < 8) errors.push("Listing title must be at least 8 characters.");
  const city = input.citySlug ? getLiveCityBySlug(input.citySlug) : undefined;
  if (!city) errors.push("Choose a city Architech currently covers.");
  const locality = input.localitySlug && city ? getLocalityBySlug(input.localitySlug, city.slug) : undefined;
  if (!locality) errors.push("Choose a locality inside the selected city.");
  if (!input.postalCode || !isValidPincode(input.postalCode)) errors.push("Enter a valid six-digit PIN.");
  else if (locality && !listingMatchesPincode(locality.slug, input.postalCode, city?.slug)) errors.push("The PIN is not linked to the selected locality; choose a reviewed combination or request location review.");
  if (!Number.isFinite(input.priceInr) || Number(input.priceInr) <= 0) errors.push("Price must be a positive INR value.");
  if (!Number.isFinite(input.bhk) || Number(input.bhk) < 1) errors.push("BHK must be at least 1.");
  if (!Number.isFinite(input.areaSqft) || Number(input.areaSqft) < 150) errors.push("Area must be at least 150 sq ft.");
  if (!isPropertyTypeCode(input.propertyType)) errors.push("Choose a reviewed property type.");
  if (!isAvailabilityCode(input.availability)) errors.push("Choose a reviewed availability status.");
  if (!input.description || input.description.trim().length < 30) errors.push("Description must be at least 30 characters.");
  if (!input.mediaRightsConfirmed) errors.push("Media rights confirmation is required before review.");
  return errors;
}

export function createListingDraft(input: ListingDraftInput, session: AuthSession | null = demoBrokerSession) {
  const errors = validateListingDraft(input, session);
  if (errors.length) return { ok: false as const, status: 400, errors };

  const now = new Date().toISOString();
  const seed = `${session!.organization!.id}:${input.title}:${input.citySlug}:${input.localitySlug}:${input.postalCode}`;
  const id = stableId("draft", seed);
  const previous = drafts.get(id);
  if (previous) {
    /* A second draft with the same title+locality is not a new listing: it is
       the same one being submitted again. Silently overwriting it would lose
       the audit trail, so the collision is surfaced and the existing draft is
       returned for the client to resume instead. */
    return {
      ok: false as const,
      status: 409,
      errors: ["A draft with this title and locality already exists — resume the existing draft instead of creating a new one."],
      existingDraft: previous,
    };
  }
  const draft: ListingDraft = {
    ...input,
    id,
    stableId: stableId("listing", seed),
    organizationId: session!.organization!.id,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    auditTrail: [audit("listing.draft.created", session!.user.email, { citySlug: input.citySlug, localitySlug: input.localitySlug, postalCode: input.postalCode, details: input.details ?? {} })],
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

/* Every draft, across organizations.

   Exists so the publish gate can see its peers. Duplicate detection is only
   meaningful across the whole corpus: two brokers pasting the same paragraph
   is precisely the case being caught, and a per-organization view would never
   see it. Nothing else should need this — a broker-facing surface must use
   `listBrokerDrafts`, which is scoped. */
export function listAllDrafts(): ListingDraft[] {
  return [...drafts.values()];
}

/** A broker's own drafts, newest-edit-first. Excludes nothing (all statuses). */
export function listBrokerDrafts(organizationId: string) {
  return [...drafts.values()]
    .filter((draft) => draft.organizationId === organizationId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function ownedDraft(draftId: string, session: AuthSession | null) {
  const draft = drafts.get(draftId);
  if (!draft) return { ok: false as const, status: 404, errors: ["Draft not found."] };
  if (!session || draft.organizationId !== session.organization?.id) return { ok: false as const, status: 403, errors: ["Organization mismatch."] };
  return { ok: true as const, draft };
}

const editableStatuses: DraftStatus[] = ["DRAFT", "CHANGES_REQUESTED", "REJECTED", "ARCHIVED"];

export function updateListingDraft(draftId: string, input: ListingDraftInput, session: AuthSession | null = demoBrokerSession) {
  const owned = ownedDraft(draftId, session);
  if (!owned.ok) return owned;
  if (!editableStatuses.includes(owned.draft.status)) return { ok: false as const, status: 409, errors: ["Only drafts needing work can be edited."] };
  const errors = validateListingDraft(input, session);
  if (errors.length) return { ok: false as const, status: 400, errors };
  const previousStatus = owned.draft.status;
  const now = new Date().toISOString();
  Object.assign(owned.draft, input, { status: "DRAFT" as const, updatedAt: now });
  owned.draft.auditTrail.push(audit("listing.draft.updated", session!.user.email, { resumedFrom: previousStatus }));
  return { ok: true as const, draft: owned.draft };
}

export function resumeListingDraft(draftId: string, session: AuthSession | null = demoBrokerSession) {
  const owned = ownedDraft(draftId, session);
  if (!owned.ok) return owned;
  if (!editableStatuses.includes(owned.draft.status)) return { ok: false as const, status: 409, errors: ["This listing cannot be resumed from its current status."] };
  const previousStatus = owned.draft.status;
  owned.draft.status = "DRAFT";
  owned.draft.updatedAt = new Date().toISOString();
  owned.draft.auditTrail.push(audit("listing.draft.resumed", session!.user.email, { previousStatus }));
  return { ok: true as const, draft: owned.draft };
}

export function archiveListingDraft(draftId: string, session: AuthSession | null = demoBrokerSession) {
  const owned = ownedDraft(draftId, session);
  if (!owned.ok) return owned;
  if (!["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(owned.draft.status)) return { ok: false as const, status: 409, errors: ["Only inactive drafts can be archived."] };
  owned.draft.status = "ARCHIVED";
  owned.draft.updatedAt = new Date().toISOString();
  owned.draft.auditTrail.push(audit("listing.draft.archived", session!.user.email));
  return { ok: true as const, draft: owned.draft };
}

export function deleteListingDraft(draftId: string, session: AuthSession | null = demoBrokerSession) {
  const owned = ownedDraft(draftId, session);
  if (!owned.ok) return owned;
  if (!["DRAFT", "CHANGES_REQUESTED", "REJECTED", "ARCHIVED"].includes(owned.draft.status)) return { ok: false as const, status: 409, errors: ["Only inactive drafts can be deleted."] };
  drafts.delete(draftId);
  draftMedia.delete(draftId);
  return { ok: true as const, deletedId: draftId };
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
