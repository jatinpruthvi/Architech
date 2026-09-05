/* Media upload policy: kind gate + per-listing quota.
 *
 * Implements the initial-phase decision in docs/media/media-storage-decision.md:
 * video upload is DISABLED on the user side while the video code path stays in
 * place behind a config gate, so it can be re-enabled without a rewrite.
 *
 * Gates (server env; the UI mirror is NEXT_PUBLIC_ARCHITECH_MEDIA_KINDS):
 *   ARCHITECH_MEDIA_KINDS=images   (default) — image/* only; video/* is
 *                        rejected at the sign endpoint with a clear 400.
 *   ARCHITECH_MEDIA_KINDS=all      — unlocks the retained video path
 *                        (video/mp4, video/quicktime) when a video provider
 *                        decision lands later.
 *
 * Quota:
 *   MEDIA_MAX_IMAGES_PER_LISTING   (default 10) — cap on non-deleted media
 *                        items per listing draft, enforced at sign time so an
 *                        account cannot fill R2 (or the DB) unbounded.
 */
import type { MediaKind } from "./upload";

export type MediaKindGate = "images" | "all";

/** Server-side gate. Unknown/absent values fall back to the safer default. */
export function getMediaKindGate(value = process.env.ARCHITECH_MEDIA_KINDS): MediaKindGate {
  return (value ?? "").trim().toLowerCase() === "all" ? "all" : "images";
}

/** Whether a media kind may be uploaded under the given gate. */
export function isKindUploadAllowed(gate: MediaKindGate, kind: MediaKind | undefined): kind is MediaKind {
  if (kind === "image") return true;
  if (kind === "video") return gate === "all";
  return false;
}

/** The user-facing reason a rejected kind is rejected — the sign endpoint
    surfaces this verbatim, so it doubles as the API contract for the gate. */
export const VIDEO_GATE_ERROR =
  "Video upload is disabled in this deployment (images only). Image types: JPEG, PNG, WebP.";

export type MediaQuota = {
  /** Non-deleted media items allowed per listing draft. */
  maxItemsPerListing: number;
};

export const DEFAULT_MAX_ITEMS_PER_LISTING = 10;

/** Parse the quota env; invalid values fall back to the default rather than
    silently disabling the cap (a parse that yields Infinity/NaN is the exact
    failure mode that would unbound uploads). */
export function getMediaQuota(env: Partial<Record<string, string | undefined>> = process.env): MediaQuota {
  const raw = Number(env.MEDIA_MAX_IMAGES_PER_LISTING);
  return {
    maxItemsPerListing: Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : DEFAULT_MAX_ITEMS_PER_LISTING,
  };
}
