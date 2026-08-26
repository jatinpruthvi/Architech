import "server-only";
import { createListingDraft, submitListingForReview, moderateListing, getModerationQueue, listBrokerDrafts, attachMediaToDraft, detachMediaFromDraft, listDraftMediaIds, type ListingDraftInput, type ModerationDecision, type ListingDraft } from "@/lib/broker/workflow";
import { demoBrokerSession, type AuthSession } from "@/lib/auth/roles";
import { isPropertyTypeCode, normalizeAvailability, type PropertyTypeCode } from "@/lib/listing-vocabulary";
import { isPrismaPersistence } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

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
  const locality = (await db.locality.findFirst({ where: { slug: draft.localitySlug } })) as { id: string } | null;
  const city = (await db.city.findFirst({ where: { slug: "ahmedabad" } })) as { id: string } | null;
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

export async function moderateListingForServer(draftId: string, decision: ModerationDecision, reason: string, session?: AuthSession) {
  const result = moderateListing(draftId, decision, reason, session);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await db.listing.updateMany({ where: { stableId: result.draft.stableId }, data: { lifecycle: LIFECYCLE_BY_DECISION[decision] } });
    await db.auditEvent.create({
      data: { action: `listing.review.${decision}`, entityType: "Listing", entityId: result.draft.stableId, metadata: { reason, source: "api.admin.moderation.prisma" } },
    });
  }
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
    organizationId: String(row.brokerOrgId ?? ""),
    status: (String(row.lifecycle ?? "IN_REVIEW") as ListingDraft["status"]) || "IN_REVIEW",
    auditTrail: [],
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}
