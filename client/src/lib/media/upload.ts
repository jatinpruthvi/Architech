export type MediaKind = "image" | "video";
export type MediaModerationStatus = "PENDING" | "APPROVED" | "REJECTED" | "TAKEDOWN_REQUESTED" | "DELETED";

export type MediaUploadInput = {
  listingDraftId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  licenseEvidence: string;
  rightsConfirmed: boolean;
};

export type SignedMediaUpload = {
  id: string;
  listingDraftId: string;
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadUrl: string;
  publicUrl: string;
  storageProvider?: "memory" | "cloudflare-r2";
  requiredHeaders: Record<string, string>;
  expiresAt: string;
  exifPolicy: "strip-before-publication";
  moderationStatus: MediaModerationStatus;
  derivatives: MediaDerivative[];
  licenseEvidence: string;
  auditTrail: MediaAudit[];
};

export type MediaDerivative = {
  kind: "original" | "webp" | "webp_800" | "thumbnail" | "hls";
  width?: number;
  height?: number;
  url: string;
  status: "planned" | "ready";
};

export type MediaAudit = {
  id: string;
  action: string;
  actor: string;
  at: string;
  metadata?: Record<string, unknown>;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const ALLOWED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO = new Set(["video/mp4", "video/quicktime"]);
const uploads = new Map<string, SignedMediaUpload>();

function stableId(prefix: string, seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${prefix}_${hash.toString(36)}`;
}

function audit(action: string, actor: string, metadata?: Record<string, unknown>): MediaAudit {
  return { id: stableId("audit", `${action}:${actor}:${Date.now()}:${Math.random()}`), action, actor, at: new Date().toISOString(), metadata };
}

function safeFileStem(fileName: string) {
  return fileName.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "media";
}

export function detectMediaKind(mimeType: string): MediaKind | undefined {
  if (ALLOWED_IMAGES.has(mimeType)) return "image";
  if (ALLOWED_VIDEO.has(mimeType)) return "video";
  return undefined;
}

export function validateMediaUpload(input: Partial<MediaUploadInput>): string[] {
  const errors: string[] = [];
  const kind = input.mimeType ? detectMediaKind(input.mimeType) : undefined;
  if (!input.listingDraftId) errors.push("Listing draft is required.");
  if (!input.fileName || input.fileName.trim().length < 3) errors.push("File name is required.");
  if (!input.mimeType || !kind) errors.push("Unsupported media type.");
  if (!Number.isFinite(input.sizeBytes) || Number(input.sizeBytes) <= 0) errors.push("File size is required.");
  if (kind === "image" && Number(input.sizeBytes) > MAX_IMAGE_BYTES) errors.push("Image must be 8 MB or smaller.");
  if (kind === "video" && Number(input.sizeBytes) > MAX_VIDEO_BYTES) errors.push("Video must be 200 MB or smaller.");
  if (!input.licenseEvidence || input.licenseEvidence.trim().length < 10) errors.push("Media license evidence is required.");
  if (!input.rightsConfirmed) errors.push("Media rights confirmation is required.");
  return errors;
}

export function planDerivatives(input: MediaUploadInput): MediaDerivative[] {
  const stem = safeFileStem(input.fileName);
  const kind = detectMediaKind(input.mimeType);
  if (kind === "video") {
    return [
      { kind: "original", url: `/media/original/${stem}`, status: "planned" },
      { kind: "thumbnail", width: 640, url: `/media/thumbs/${stem}.webp`, status: "planned" },
      { kind: "hls", url: `/media/hls/${stem}/master.m3u8`, status: "planned" },
    ];
  }
  return [
    { kind: "original", width: input.width, height: input.height, url: `/media/original/${stem}`, status: "planned" },
    { kind: "webp", width: input.width, height: input.height, url: `/media/derived/${stem}.webp`, status: "planned" },
    { kind: "webp_800", width: 800, url: `/media/derived/${stem}-800.webp`, status: "planned" },
    { kind: "thumbnail", width: 320, url: `/media/thumbs/${stem}.webp`, status: "planned" },
  ];
}

export function createSignedMediaUpload(input: MediaUploadInput) {
  const errors = validateMediaUpload(input);
  if (errors.length) return { ok: false as const, status: 400, errors };
  const kind = detectMediaKind(input.mimeType)!;
  const key = `${input.listingDraftId}:${input.fileName}:${input.sizeBytes}`;
  const id = stableId("media", key);
  const existing = uploads.get(id);
  if (existing) return { ok: true as const, upload: existing, duplicate: true };

  const upload: SignedMediaUpload = {
    id,
    listingDraftId: input.listingDraftId,
    kind,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    uploadUrl: `https://uploads.architech.invalid/${id}`,
    publicUrl: `/media/pending/${id}/${encodeURIComponent(input.fileName)}`,
    requiredHeaders: { "content-type": input.mimeType, "x-architech-media-id": id },
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    exifPolicy: "strip-before-publication",
    moderationStatus: "PENDING",
    derivatives: planDerivatives(input),
    licenseEvidence: input.licenseEvidence.trim(),
    auditTrail: [audit("media.upload.signed", "broker", { kind, sizeBytes: input.sizeBytes })],
  };
  uploads.set(id, upload);
  return { ok: true as const, upload, duplicate: false };
}

export function completeMediaUpload(uploadId: string) {
  const upload = uploads.get(uploadId);
  if (!upload) return { ok: false as const, status: 404, errors: ["Upload not found."] };
  upload.derivatives = upload.derivatives.map((derivative) => ({ ...derivative, status: "ready" }));
  upload.auditTrail.push(audit("media.upload.completed", "system", { exifStripped: true, derivatives: upload.derivatives.length }));
  return { ok: true as const, upload };
}

export function moderateMedia(uploadId: string, status: Exclude<MediaModerationStatus, "PENDING">, reason: string) {
  const upload = uploads.get(uploadId);
  if (!upload) return { ok: false as const, status: 404, errors: ["Upload not found."] };
  upload.moderationStatus = status;
  upload.auditTrail.push(audit(`media.moderation.${status.toLowerCase()}`, "moderator", { reason }));
  return { ok: true as const, upload };
}

export function getMediaUpload(uploadId: string) {
  return uploads.get(uploadId);
}

/** Request a takedown (retention/holding) for a media record. */
export function requestMediaTakedown(uploadId: string, reason: string): { ok: true; upload: SignedMediaUpload } | { ok: false; status: number; errors: string[] } {
  const upload = uploads.get(uploadId);
  if (!upload) return { ok: false, status: 404, errors: ["Upload not found."] };
  upload.moderationStatus = "TAKEDOWN_REQUESTED";
  upload.auditTrail.push(audit("media.takedown.requested", "moderator", { reason }));
  return { ok: true, upload };
}

/** Hard-delete a media record after takedown confirmation (retention-privacy). */
export function deleteMedia(uploadId: string): { ok: true; id: string } | { ok: false; status: number; errors: string[] } {
  const upload = uploads.get(uploadId);
  if (!upload) return { ok: false, status: 404, errors: ["Upload not found."] };
  upload.moderationStatus = "DELETED";
  upload.auditTrail.push(audit("media.deleted", "system", {})) ;
  uploads.delete(uploadId);
  return { ok: true, id: uploadId };
}

export function resetMediaStoreForTests() {
  uploads.clear();
}
