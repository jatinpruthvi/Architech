import "server-only";
import { createSignedMediaUpload, detectMediaKind, type MediaUploadInput } from "@/lib/media/upload";
import { getMediaStorageProvider, mediaObjectKey, type MediaStorageProvider } from "@/lib/media/provider";
import { getMediaKindGate, getMediaQuota, VIDEO_GATE_ERROR, type MediaKindGate } from "@/lib/media/policy";
import { countActiveMediaForDraftForServer, createMediaUploadForServer } from "@/lib/persistence/media-store";
import { isPrismaPersistence } from "@/lib/persistence/source";

export { getMediaStorageProvider };
export type { MediaStorageProvider };

function gateAllowsKind(gate: MediaKindGate, kind: "image" | "video" | undefined) {
  if (kind === "image") return true;
  if (kind === "video") return gate === "all";
  return false;
}

/**
 * The server sign endpoint: validates, applies the media policy, signs a
 * direct-to-storage upload URL, and (in prisma mode) persists the record.
 *
 * Media policy (docs/media/media-storage-decision.md):
 *  - KIND GATE: the initial phase is images-only. `ARCHITECH_MEDIA_KINDS=all`
 *    re-enables the retained video path; the default refuses `video/*` here so
 *    the bytes never leave the browser — the UI hides video too, but the
 *    server is the authoritative gate.
 *  - QUOTA: `MEDIA_MAX_IMAGES_PER_LISTING` caps non-deleted items per draft so
 *    one account cannot unbound object storage or the DB.
 */
export async function createSignedMediaUploadForServer(input: MediaUploadInput) {
  const result = createSignedMediaUpload(input);
  if (!result.ok) return result;

  // KIND GATE — authoritative. Runs after base validation so the error list
  // stays consistent, and before any signing so a gated kind never gets a URL.
  const kind = detectMediaKind(input.mimeType);
  if (!gateAllowsKind(getMediaKindGate(), kind)) {
    return { ok: false as const, status: 400, errors: [VIDEO_GATE_ERROR] };
  }

  // QUOTA — count non-deleted items already attached to this draft. The new
  // record's stable id is excluded so re-signing an in-flight upload (a
  // duplicate request) is not counted against its own quota.
  const quota = getMediaQuota();
  const existing = await countActiveMediaForDraftForServer(input.listingDraftId, result.upload.id);
  if (existing >= quota.maxItemsPerListing) {
    return {
      ok: false as const,
      status: 409,
      errors: [`This listing already has ${quota.maxItemsPerListing} media items (the maximum). Remove one before adding more.`],
    };
  }

  const provider = getMediaStorageProvider();
  const objectKey = mediaObjectKey(input, result.upload.id);
  const signed = await provider.signUpload({ ...input, uploadId: result.upload.id, objectKey });

  // Persist a durable PropertyMedia record when the data source is `prisma`.
  // Idempotent: the shared stable id means this reconciles with the contract
  // upload without creating a second record. The objectKey is stored so the
  // retention sweep / takedown can delete the R2 object, not just the row.
  if (isPrismaPersistence()) await createMediaUploadForServer(input, { objectKey });

  return {
    ...result,
    upload: {
      ...result.upload,
      uploadUrl: signed.uploadUrl,
      publicUrl: signed.publicUrl,
      storageProvider: signed.provider,
      requiredHeaders: signed.requiredHeaders,
      expiresAt: signed.expiresAt,
      auditTrail: [
        ...result.upload.auditTrail,
        {
          id: `audit_${result.upload.id}_${signed.provider}`,
          action: `media.storage.${signed.provider}.signed`,
          actor: "system",
          at: new Date().toISOString(),
          metadata: { provider: signed.provider, objectKey },
        },
      ],
    },
  };
}
