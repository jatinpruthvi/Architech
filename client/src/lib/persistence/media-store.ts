import "server-only";
import { createSignedMediaUpload, completeMediaUpload, deleteMedia, listMediaUploadRecords, moderateMedia, requestMediaTakedown, type MediaUploadInput, type MediaModerationStatus } from "@/lib/media/upload";
import { deleteMediaObjectBestEffort } from "@/lib/media/server/lifecycle";
import { isPrismaPersistence } from "./source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";

type MediaPrismaClient = ReturnType<typeof getPrismaClient> & {
  listing: { findFirst(args: unknown): Promise<{ id: string } | null> };
  propertyMedia: {
    upsert(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
    findFirst(args: unknown): Promise<{ objectKey?: string | null } | null>;
    count(args: unknown): Promise<number>;
  };
  auditEvent: { create(args: unknown): Promise<unknown> };
};

const prisma = () => getPrismaClient() as unknown as MediaPrismaClient;

/** Count non-DELETED media items attached to one listing draft.
    Used by the per-listing upload quota (media-storage-decision phase 4).
    `excludeId` lets the sign flow ignore the record it is about to create,
    so re-signing an in-flight upload does not count against its own quota. */
export async function countActiveMediaForDraftForServer(listingDraftId: string, excludeId?: string): Promise<number> {
  if (!isPrismaPersistence()) {
    return listMediaUploadRecords().filter((record) => record.listingDraftId === listingDraftId && record.moderationStatus !== "DELETED" && record.id !== excludeId).length;
  }
  const db = prisma();
  const listing = await db.listing.findFirst({ where: { OR: [{ stableId: listingDraftId }, { slug: listingDraftId }] } });
  if (!listing) return 0;
  const count = await db.propertyMedia.count({
    where: { listingId: (listing as { id: string }).id, moderationStatus: { not: "DELETED" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  return count;
}

/** Persist media record metadata on signed upload. Write-through to Prisma
    `PropertyMedia` when the persistence source is `prisma`. `objectKey` is
    the storage key the sign endpoint issued — the retention sweep and the
    takedown path need it to delete the R2 object, not just the row. */
export async function createMediaUploadForServer(input: MediaUploadInput, options: { objectKey?: string } = {}) {
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
      update: { url: result.upload.publicUrl, moderationStatus: "PENDING", licenseEvidence: result.upload.licenseEvidence, ...(options.objectKey ? { objectKey: options.objectKey } : {}) },
      create: {
        id: result.upload.id,
        listingId,
        kind: result.upload.kind,
        url: result.upload.publicUrl,
        objectKey: options.objectKey ?? null,
        alt: input.fileName,
        derivatives: result.upload.derivatives,
        licenseEvidence: result.upload.licenseEvidence,
        /* Honest until a real EXIF-strip/transcode processor runs (B-17). */
        exifStripped: false,
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
    /* Read the object key BEFORE the row is flipped so the sweep/takedown
       can target the R2 object that matches this exact record. */
    const row = await db.propertyMedia.findFirst({ where: { id: uploadId }, select: { objectKey: true } });
    await db.propertyMedia.updateMany({ where: { id: uploadId }, data: { moderationStatus: "DELETED" } });
    await db.auditEvent.create({ data: { action: "media.deleted", entityType: "PropertyMedia", entityId: uploadId, metadata: { source: "api.admin.media.delete.prisma" } } });
    const deletion = await deleteMediaObjectBestEffort(row?.objectKey ?? null);
    if (!deletion.ok) {
      await db.auditEvent.create({ data: { action: "media.object_delete_failed", entityType: "PropertyMedia", entityId: uploadId, metadata: { error: deletion.error, status: deletion.status } } });
    }
  }
  return result;
}
