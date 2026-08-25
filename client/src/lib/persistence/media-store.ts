import "server-only";
import { createSignedMediaUpload, completeMediaUpload, deleteMedia, moderateMedia, requestMediaTakedown, type MediaUploadInput, type MediaModerationStatus } from "@/lib/media/upload";
import { isPrismaPersistence } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

type MediaPrismaClient = ReturnType<typeof getPrismaClient> & {
  listing: { findFirst(args: unknown): Promise<{ id: string } | null> };
  propertyMedia: {
    upsert(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  auditEvent: { create(args: unknown): Promise<unknown> };
};

const prisma = () => getPrismaClient() as unknown as MediaPrismaClient;

/** Persist media record metadata on signed upload. Write-through to Prisma
    `PropertyMedia` when the persistence source is `prisma`. */
export async function createMediaUploadForServer(input: MediaUploadInput) {
  const result = createSignedMediaUpload(input);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    // Resolve the owning listing (by stableId or slug) so the PropertyMedia FK
    // is valid; if the listing has not been persisted yet, keep the record
    // in-memory only rather than writing an orphaned row.
    const listing = await db.listing.findFirst({ where: { OR: [{ stableId: input.listingDraftId }, { slug: input.listingDraftId }] } });
    if (!listing) return { ok: true as const, upload: result.upload, duplicate: result.duplicate };
    const listingId = (listing as { id: string }).id;
    await db.propertyMedia.upsert({
      where: { id: result.upload.id },
      update: { url: result.upload.publicUrl, moderationStatus: "PENDING", licenseEvidence: result.upload.licenseEvidence },
      create: {
        id: result.upload.id,
        listingId,
        kind: result.upload.kind,
        url: result.upload.publicUrl,
        alt: input.fileName,
        derivatives: result.upload.derivatives,
        licenseEvidence: result.upload.licenseEvidence,
        exifStripped: true,
        sortOrder: 0,
        moderationStatus: "PENDING",
      },
    });
    await db.auditEvent.create({
      data: { action: "media.upload.signed", entityType: "PropertyMedia", entityId: result.upload.id, metadata: { listingId: input.listingDraftId, source: "api.media.sign.prisma" } },
    });
  }
  return result;
}

export async function completeMediaUploadForServer(uploadId: string) {
  const result = completeMediaUpload(uploadId);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await db.propertyMedia.updateMany({ where: { id: uploadId }, data: { derivatives: result.upload.derivatives } });
  }
  return result;
}

export async function moderateMediaForServer(uploadId: string, status: Exclude<MediaModerationStatus, "PENDING">, reason: string) {
  const result = moderateMedia(uploadId, status, reason);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await db.propertyMedia.updateMany({ where: { id: uploadId }, data: { moderationStatus: status } });
    await db.auditEvent.create({
      data: { action: `media.moderation.${status.toLowerCase()}`, entityType: "PropertyMedia", entityId: uploadId, metadata: { reason, source: "api.admin.media.moderate.prisma" } },
    });
  }
  return result;
}

export async function requestMediaTakedownForServer(uploadId: string, reason: string) {
  const result = requestMediaTakedown(uploadId, reason);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await db.propertyMedia.updateMany({ where: { id: uploadId }, data: { moderationStatus: "TAKEDOWN_REQUESTED" } });
    await db.auditEvent.create({ data: { action: "media.takedown.requested", entityType: "PropertyMedia", entityId: uploadId, metadata: { reason, source: "api.admin.media.takedown.prisma" } } });
  }
  return result;
}

export async function deleteMediaForServer(uploadId: string) {
  const result = deleteMedia(uploadId);
  if (!result.ok) return result;
  if (isPrismaPersistence()) {
    const db = prisma();
    await db.propertyMedia.updateMany({ where: { id: uploadId }, data: { moderationStatus: "DELETED" } });
    await db.auditEvent.create({ data: { action: "media.deleted", entityType: "PropertyMedia", entityId: uploadId, metadata: { source: "api.admin.media.delete.prisma" } } });
  }
  return result;
}
