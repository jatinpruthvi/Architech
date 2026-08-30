import "server-only";
import { createListingDraft, submitListingForReview, moderateListing, getModerationQueue, listBrokerDrafts, listAllDrafts, attachMediaToDraft, detachMediaFromDraft, listDraftMediaIds, updateListingDraft, resumeListingDraft, archiveListingDraft, deleteListingDraft, type ListingDraftInput, type ModerationDecision, type ListingDraft } from "@/lib/broker/workflow";
import { evaluatePublishGate, type PublishGateDecision, type PublishGatePeer, type PublishGateSubject } from "@/lib/listing/publish-gate";
import { emitListingEvent } from "@/lib/listing/events";
import { getMediaUpload } from "@/lib/media/upload";
import { demoBrokerSession, type AuthSession } from "@/lib/auth/roles";
import { isPropertyTypeCode, normalizeAvailability, type PropertyTypeCode } from "@/lib/listing-vocabulary";
import { listingDetailsFromSourceSummary } from "@/lib/listing-details-contract";
import { isPrismaPersistence } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { DEFAULT_CITY_SLUG, getLocalityBySlug } from "@/lib/repositories";

type BrokerPrismaClient = ReturnType<typeof getPrismaClient> & {
  listing: { upsert(args: unknown): Promise<unknown>; updateMany(args: unknown): Promise<{ count: number }>; findMany(args: unknown): Promise<Array<Record<string, unknown>>> };
  locality: { findFirst(args: unknown): Promise<{ id: string; slug: string } | null> };
  city: { findFirst(args: unknown): Promise<{ id: string; slug: string } | null> };
  auditEvent: { create(args: unknown): Promise<unknown> };
};

const prisma = () => getPrismaClient() as unknown as BrokerPrismaClient;

const LIFECYCLE_BY_DECISION: Record<ModerationDecision, "ACTIVE" | "CHANGES_REQUESTED" | "REJECTED"> = {
  approve: "ACTIVE",
  request_changes: "CHANGES_REQUESTED",
  reject: "REJECTED",
};

async function upsertDraftListing(db: BrokerPrismaClient, draft: ListingDraft) {
  const locality = (await db.locality.findFirst({ where: { slug: draft.localitySlug } })) as { id: string; cityId?: string } | null;
  // The city comes from the draft's locality, so a broker in any covered city
  // persists against the right city row instead of a hardcoded one.
  const citySlug = getLocalityBySlug(draft.localitySlug)?.citySlug ?? DEFAULT_CITY_SLUG;
  const city = (await db.city.findFirst({ where: { slug: citySlug } })) as { id: string } | null;
  if (!locality || !city) return;
  await db.listing.upsert({
    where: { stableId: draft.stableId },
    update: {
      title: draft.title,
      lifecycle: draft.status as string,
      priceInr: draft.priceInr,
      bhk: draft.bhk,
      areaSqft: draft.areaSqft,
      propertyType: draft.propertyType,
      availability: draft.availability,
      description: draft.description,
      sourceSummary: JSON.stringify(draft.details ?? {}),
      cityId: city.id,
      localityId: locality.id,
    },
    create: {
      stableId: draft.stableId,
      slug: draft.stableId.replace(/_/g, "-"),
      title: draft.title,
      description: draft.description,
      lifecycle: draft.status as string,
      verification: "DEMO",
      translationStatus: "ENGLISH_ONLY",
      propertyType: draft.propertyType,
      priceInr: draft.priceInr,
      priceLabel: `₹${(draft.priceInr / 10000000).toFixed(2)} Cr`,
      bhk: draft.bhk,
      areaSqft: draft.areaSqft,
      availability: draft.availability,
      brokerOrgId: draft.organizationId,
      sourceSummary: JSON.stringify(draft.details ?? {}),
      cityId: city.id,
      localityId: locality.id,
    },
  });
}

export async function createListingDraftForServer(input: ListingDraftInput, session: AuthSession = demoBrokerSession) {
  const result = createListingDraft(input, session);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await upsertDraftListing(db, result.draft);
    await db.auditEvent.create({
      data: { action: "listing.draft.created", entityType: "Listing", entityId: result.draft.stableId, metadata: { localitySlug: input.localitySlug, source: "api.broker.listings.prisma" } },
    });
  }
  return result;
}

export async function updateListingDraftForServer(draftId: string, input: ListingDraftInput, session: AuthSession = demoBrokerSession) {
  const result = updateListingDraft(draftId, input, session);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await upsertDraftListing(db, result.draft);
    await db.auditEvent.create({ data: { action: "listing.draft.updated", entityType: "Listing", entityId: result.draft.stableId, metadata: { source: "api.broker.listings.update.prisma" } } });
  }
  return result;
}

export async function resumeListingDraftForServer(draftId: string, session: AuthSession = demoBrokerSession) {
  const result = resumeListingDraft(draftId, session);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await db.listing.updateMany({ where: { stableId: result.draft.stableId, brokerOrgId: session.organization?.id ?? result.draft.organizationId }, data: { lifecycle: "DRAFT" } });
    await db.auditEvent.create({ data: { action: "listing.draft.resumed", entityType: "Listing", entityId: result.draft.stableId, metadata: { source: "api.broker.listings.resume.prisma" } } });
  }
  return result;
}

export async function archiveListingDraftForServer(draftId: string, session: AuthSession = demoBrokerSession) {
  const before = listAllDrafts().find((item) => item.id === draftId) ?? null;
  const result = archiveListingDraft(draftId, session);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await db.listing.updateMany({ where: { stableId: result.draft.stableId, brokerOrgId: session.organization?.id ?? result.draft.organizationId }, data: { lifecycle: "ARCHIVED" } });
    await db.auditEvent.create({ data: { action: "listing.draft.archived", entityType: "Listing", entityId: result.draft.stableId, metadata: { source: "api.broker.listings.archive.prisma" } } });
  }
  /* Removed from public visibility. The spine has to hear about it too: a
   downstream consumer that only ever sees `listing.published` will keep a
   de-listed page in the sitemap and keep requesting indexing for it. */
  await emitListingEvent({
    type: "listing.unpublished",
    stableId: result.draft.stableId,
    draftId,
    localitySlug: result.draft.localitySlug,
    citySlug: getLocalityBySlug(result.draft.localitySlug)?.citySlug,
    previousLifecycle: before?.status ?? null,
    nextLifecycle: result.draft.status,
    meta: { actor: session?.user.email ?? "unknown", cause: "listing.draft.archived" },
  });

  return result;
}

export async function deleteListingDraftForServer(draftId: string, session: AuthSession = demoBrokerSession) {
  const before = listAllDrafts().find((item) => item.id === draftId) ?? null;
  const result = deleteListingDraft(draftId, session);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await db.listing.updateMany({ where: { stableId: draftId, brokerOrgId: session.organization?.id ?? "" }, data: { lifecycle: "REMOVED" } });
    await db.auditEvent.create({ data: { action: "listing.draft.deleted", entityType: "Listing", entityId: draftId, metadata: { source: "api.broker.listings.delete.prisma" } } });
  }
  /* Removed from public visibility. The spine has to hear about it too: a
     downstream consumer that only ever sees `listing.published` will keep a
     de-listed page in the sitemap and keep requesting indexing for it.

     Everything but the identity comes from `before`, captured above: deletion
     returns only an id, and by the time this runs the draft is gone. */
  if (before) {
    await emitListingEvent({
      type: "listing.unpublished",
      stableId: before.stableId,
      draftId,
      localitySlug: before.localitySlug,
      citySlug: getLocalityBySlug(before.localitySlug)?.citySlug,
      previousLifecycle: before.status,
      nextLifecycle: "REMOVED",
      meta: { actor: session?.user.email ?? "unknown", cause: "listing.draft.deleted" },
    });
  }

  return result;
}

export async function submitListingForReviewForServer(draftId: string, session: AuthSession = demoBrokerSession) {
  const result = submitListingForReview(draftId, session);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await db.listing.updateMany({ where: { stableId: result.draft.stableId, brokerOrgId: session.organization?.id ?? result.draft.organizationId }, data: { lifecycle: "IN_REVIEW" } });
    await db.auditEvent.create({
      data: { action: "listing.review.submitted", entityType: "Listing", entityId: result.draft.stableId, metadata: { source: "api.broker.listings.submit.prisma" } },
    });
  }
  return result;
}

/* The publish gate, wired to drafts.

   `evaluatePublishGate` is pure; this is where a draft becomes a subject and
   the other drafts become peers. Two things here are worth knowing:

   A peer counts as `published` only when its status is ACTIVE. Canonicalizing
   to a draft that has not been approved would point Google at a page that
   does not exist, so the gate itself refuses to do it — see
   `nearestPublishedDuplicate`.

   Media is read live from the media store rather than from the draft, because
   a broker can detach a photograph after submitting for review. The rights
   confirmation on the draft is from whatever moment it was filled in; the
   photographs attached right now are a present fact. */
/* Whether an attached medium may actually be shown.

   `listDraftMediaIds` returns whatever was attached, with no view of its
   moderation state. That is a hole in the one promise the gate makes: a
   listing whose only photograph was later rejected or taken down would still
   count as having one, and would publish a page whose image cannot be shown —
   the exact rights failure the media pipeline exists to prevent.

   An id the media store does not recognise is counted rather than rejected.
   Those are fixture and legacy ids, and refusing them would block listings for
   a bookkeeping reason the broker cannot see or fix. */
function isShowableMedium(mediaId: string): boolean {
  const upload = getMediaUpload(mediaId);
  if (!upload) return true;
  return upload.moderationStatus === "APPROVED";
}

function draftGateSubject(draft: ListingDraft): PublishGateSubject {
  return {
    stableId: draft.stableId,
    draftId: draft.id,
    title: draft.title,
    description: draft.description,
    priceInr: draft.priceInr,
    bhk: draft.bhk,
    areaSqft: draft.areaSqft,
    propertyType: draft.propertyType,
    availability: draft.availability,
    localitySlug: draft.localitySlug,
    reraNumber: draft.reraNumber,
    mediaRightsConfirmed: draft.mediaRightsConfirmed,
    mediaCount: listDraftMediaIds(draft.id).filter(isShowableMedium).length,
  };
}

function draftGatePeers(draft: ListingDraft): PublishGatePeer[] {
  return listAllDrafts()
    .filter((peer) => peer.stableId !== draft.stableId && peer.localitySlug === draft.localitySlug)
    .map((peer) => ({
      stableId: peer.stableId,
      title: peer.title,
      description: peer.description,
      localitySlug: peer.localitySlug,
      published: peer.status === "ACTIVE",
    }));
}

/** Evaluate whether a draft may become publicly visible, with reasons. */
export function evaluateDraftPublishGate(draftId: string): { ok: true; draft: ListingDraft; decision: PublishGateDecision } | { ok: false; status: 404; errors: string[] } {
  const draft = listAllDrafts().find((item) => item.id === draftId);
  if (!draft) return { ok: false, status: 404, errors: ["Draft not found."] };
  return { ok: true, draft, decision: evaluatePublishGate(draftGateSubject(draft), draftGatePeers(draft)) };
}

/* Moderation is the choke point.

   Every path that makes a listing publicly visible ends here, so this is where
   the publish gate and the event spine belong — inside the transition, not
   beside it. A gate placed beside the transition is a gate someone can route
   around by adding a second write path.

   The gate only runs on `approve`. Requesting changes or rejecting a listing
   cannot make anything public, and gating them would be refusing to let a
   moderator send work back.

   A blocked approval leaves the draft at IN_REVIEW and returns the reasons.
   That is what makes this a gate rather than a wall: the moderator sees
   exactly what the broker has to fix, and can send it back with those reasons
   attached instead of guessing. */
export async function moderateListingForServer(draftId: string, decision: ModerationDecision, reason: string, session?: AuthSession) {
  const before = listAllDrafts().find((item) => item.id === draftId) ?? null;
  const previousLifecycle = before?.status ?? null;
  const gate = decision === "approve" ? evaluateDraftPublishGate(draftId) : null;

  if (gate?.ok && gate.decision.action === "block") {
    await emitListingEvent({
      type: "listing.gate_blocked",
      stableId: gate.draft.stableId,
      draftId,
      localitySlug: gate.draft.localitySlug,
      citySlug: getLocalityBySlug(gate.draft.localitySlug)?.citySlug,
      previousLifecycle,
      nextLifecycle: null,
      meta: { reason, blockers: gate.decision.blockers, warnings: gate.decision.warnings, actor: session?.user.email ?? "unknown" },
    });
    return { ok: false as const, status: 422, errors: gate.decision.blockers, warnings: gate.decision.warnings };
  }

  const result = moderateListing(draftId, decision, reason, session);
  if (!result.ok) return result;

  const canonicalToListingId = gate?.ok ? gate.decision.canonicalToListingId : undefined;

  if (isPrismaPersistence()) {
    const db = prisma();
    await db.listing.updateMany({ where: { stableId: result.draft.stableId }, data: { lifecycle: LIFECYCLE_BY_DECISION[decision] } });
    /* The canonical column has existed since the schema was written and was
       referenced by nothing. This is its first writer: a near-duplicate is
       published but points at the listing it duplicates, so Google sees one
       page rather than two competing ones. */
    if (canonicalToListingId) {
      await db.listing.updateMany({ where: { stableId: result.draft.stableId }, data: { canonicalToListingId } });
    }
    await db.auditEvent.create({
      data: { action: `listing.review.${decision}`, entityType: "Listing", entityId: result.draft.stableId, metadata: { reason, source: "api.admin.moderation.prisma", canonicalToListingId: canonicalToListingId ?? null } },
    });
  }

  await emitListingEvent({
    type: decision !== "approve" ? "listing.unpublished" : canonicalToListingId ? "listing.canonicalized" : "listing.published",
    stableId: result.draft.stableId,
    draftId,
    localitySlug: result.draft.localitySlug,
    citySlug: getLocalityBySlug(result.draft.localitySlug)?.citySlug,
    previousLifecycle,
    nextLifecycle: LIFECYCLE_BY_DECISION[decision],
    meta: { reason, actor: session?.user.email ?? "unknown", canonicalToListingId: canonicalToListingId ?? null },
  });

  return result;
}

export async function getModerationQueueForServer() {
  if (!isPrismaPersistence()) return getModerationQueue();
  const db = prisma();
  const rows = (await db.listing.findMany({ where: { lifecycle: "IN_REVIEW" } })) as Array<Record<string, unknown>>;
  return rows.map((row) => contractFromRow(row));
}

/** A broker's own drafts (all statuses), newest-edit-first. */
export async function listBrokerDraftsForServer(organizationId: string): Promise<ListingDraft[]> {
  if (!isPrismaPersistence()) return listBrokerDrafts(organizationId);
  const db = prisma();
  const rows = (await db.listing.findMany({
    where: { brokerOrgId: organizationId },
    orderBy: { updatedAt: "desc" },
  })) as Array<Record<string, unknown>>;
  return rows.map((row) => contractFromRow(row));
}

/** Attach a media id to a broker draft, recording an audit event in prisma mode. */
export async function attachMediaToDraftForServer(draftId: string, mediaId: string, session: AuthSession = demoBrokerSession) {
  const result = attachMediaToDraft(draftId, mediaId, session);
  if (result.ok && isPrismaPersistence()) {
    const db = prisma();
    await db.auditEvent.create({
      data: { action: "listing.draft.media.attached", entityType: "Listing", entityId: draftId, metadata: { mediaId, source: "api.broker.listings.media.prisma" } },
    });
  }
  return result;
}

/** Detach a media id from a broker draft, recording an audit event in prisma mode. */
export async function detachMediaFromDraftForServer(draftId: string, mediaId: string, session: AuthSession = demoBrokerSession) {
  const result = detachMediaFromDraft(draftId, mediaId, session);
  if (result.ok && isPrismaPersistence()) {
    const db = prisma();
    await db.auditEvent.create({
      data: { action: "listing.draft.media.detached", entityType: "Listing", entityId: draftId, metadata: { mediaId, source: "api.broker.listings.media.prisma" } },
    });
  }
  return result;
}

/** List media ids attached to a broker draft. */
export async function listDraftMediaForServer(draftId: string, session: AuthSession = demoBrokerSession): Promise<string[]> {
  return listDraftMediaIds(draftId, session);
}

function contractFromRow(row: Record<string, unknown>): ListingDraft {
  return {
    id: String(row.id ?? ""),
    stableId: String(row.stableId ?? ""),
    title: String(row.title ?? ""),
    localitySlug: String(row.localitySlug ?? ""),
    priceInr: Number(row.priceInr ?? 0),
    bhk: Number(row.bhk ?? 0),
    areaSqft: Number(row.areaSqft ?? 0),
    availability: normalizeAvailability(row.availability) ?? "READY_TO_MOVE",
    propertyType: isPropertyTypeCode(row.propertyType) ? row.propertyType as PropertyTypeCode : "APARTMENT",
    description: String(row.description ?? ""),
    mediaRightsConfirmed: true,
    /* Same contract as the public read path (repositories/mappers.ts). This
       used to be a second, looser copy of the parser, which is how "one column,
       two meanings" became "one column, two behaviours": the broker's own draft
       round-tripped unvalidated JSON while the shopper-facing path silently
       dropped it. */
    details: listingDetailsFromSourceSummary(typeof row.sourceSummary === "string" ? row.sourceSummary : null),
    organizationId: String(row.brokerOrgId ?? ""),
    status: (String(row.lifecycle ?? "IN_REVIEW") as ListingDraft["status"]) || "IN_REVIEW",
    auditTrail: [],
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}
