import "server-only";
import { getMediaStorageMode } from "@/lib/media/source";
import { getMediaStorageProvider, type MediaDeleteResult } from "@/lib/media/provider";

export type ObjectDeletionOutcome = MediaDeleteResult & { skipped: boolean };

/**
 * Delete a media object from storage, best-effort.
 *
 * Called by the retention sweep and the takedown path when policy says the
 * bytes must go (docs/media/media-storage-decision.md, phase 4). Failures are
 * RETURNED, never thrown: an R2 outage must not wedge the retention sweep or
 * the moderator's takedown action — the DB state change is the source of
 * truth, and a later sweep retry deletes the orphaned object. Callers log the
 * failure as `media.object_delete_failed` so the orphan is observable.
 *
 * `skipped: true` means there was nothing to do (no object key, or memory
 * storage mode, where no object ever existed).
 */
export async function deleteMediaObjectBestEffort(objectKey?: string | null): Promise<ObjectDeletionOutcome> {
  if (!objectKey) return { ok: true, skipped: true };
  if (getMediaStorageMode() !== "r2") return { ok: true, skipped: true };
  try {
    const result = await getMediaStorageProvider().deleteObject(objectKey);
    return result.ok ? { ...result, skipped: false } : { ...result, skipped: false };
  } catch (error) {
    return { ok: false, skipped: false, error: error instanceof Error ? error.message : String(error) };
  }
}
