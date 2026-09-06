import type { MediaUploadInput } from "./upload";
import { detectMediaKind } from "./upload";
import { presignPutUrl, signRequest } from "./sigv4";
import { getMediaStorageMode, validateR2Environment } from "./source";

export type MediaStorageProviderId = "memory" | "cloudflare-r2";

export type MediaSignRequest = MediaUploadInput & {
  uploadId: string;
  objectKey: string;
};

export type MediaSignResult = {
  provider: MediaStorageProviderId;
  uploadUrl: string;
  publicUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
};

/** Provider factory: `ARCHITECH_MEDIA_STORAGE` selects memory (dev default)
    or R2 (staging/production). Lives here — not in server/upload.ts — so the
    lifecycle helpers can reach the active provider without an import cycle. */
export function getMediaStorageProvider(mode: ReturnType<typeof getMediaStorageMode> = getMediaStorageMode()): MediaStorageProvider {
  if (mode === "r2") {
    const env = validateR2Environment();
    if (!env.ok) throw new Error(`R2 media storage is missing: ${env.missing.join(", ")}`);
    return new R2MediaStorageProvider();
  }
  return new MemoryMediaStorageProvider();
}

export type MediaDeleteResult = { ok: true } | { ok: false; status?: number; error: string };

export interface MediaStorageProvider {
  id: MediaStorageProviderId;
  signUpload(input: MediaSignRequest): Promise<MediaSignResult>;
  /**
   * Delete the stored object for a key. Called by the retention sweep and the
   * takedown path when the policy says the bytes must go (docs/media/
   * media-storage-decision.md, phase 4) — marking the DB row DELETED without
   * removing the object is how rejected media turns into permanent storage
   * bill. Idempotent: deleting an already-gone object is a success.
   */
  deleteObject(objectKey: string): Promise<MediaDeleteResult>;
}

export function mediaObjectKey(input: Pick<MediaUploadInput, "listingDraftId" | "fileName">, uploadId: string) {
  const safeName = input.fileName.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
  return `listing-drafts/${input.listingDraftId}/${uploadId}/${safeName || "media"}`;
}

export class MemoryMediaStorageProvider implements MediaStorageProvider {
  id = "memory" as const;

  async signUpload(input: MediaSignRequest): Promise<MediaSignResult> {
    return {
      provider: this.id,
      uploadUrl: `https://uploads.architech.invalid/${input.uploadId}`,
      publicUrl: `/media/pending/${input.uploadId}/${encodeURIComponent(input.fileName)}`,
      requiredHeaders: { "content-type": input.mimeType, "x-architech-media-id": input.uploadId },
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  /** Memory mode never persisted bytes anywhere — there is nothing to delete. */
  async deleteObject(_objectKey: string): Promise<MediaDeleteResult> {
    return { ok: true };
  }
}

export class R2MediaStorageProvider implements MediaStorageProvider {
  id = "cloudflare-r2" as const;

  constructor(private env: NodeJS.ProcessEnv = process.env) {}

  async signUpload(input: MediaSignRequest): Promise<MediaSignResult> {
    const accountId = this.env.R2_ACCOUNT_ID;
    const bucket = this.env.R2_BUCKET;
    const publicBase = this.env.R2_PUBLIC_BASE_URL;
    const accessKeyId = this.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = this.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !bucket || !publicBase) throw new Error("R2 media storage is not configured.");
    /* Fail CLOSED on missing credentials: returning a fake-"signed" URL
       (the old `?signed=placeholder` string) would send the browser to PUT
       against an endpoint that must reject it, and the upload would die
       quietly two steps later. Unconfigured means unavailable, loudly. */
    if (!accessKeyId || !secretAccessKey) throw new Error("R2 media storage credentials are not configured.");
    const kind = detectMediaKind(input.mimeType) ?? "image";
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${input.objectKey}`;
    const TTL_SECONDS = 900;
    /* Real SigV4 presigning (lib/media/sigv4.ts, pinned to the official AWS
       worked example): the secret stays on the server, the browser gets a
       15-minute, host-bound, one-key PUT URL. Region is `auto` per the R2
       S3-API contract; override via R2_REGION only if Cloudflare ever
       publishes a narrower one. */
    const uploadUrl = presignPutUrl({
      method: "PUT",
      url: endpoint,
      region: this.env.R2_REGION || "auto",
      service: "s3",
      accessKeyId,
      secretAccessKey,
      expiresInSeconds: TTL_SECONDS,
    });
    return {
      provider: this.id,
      uploadUrl,
      publicUrl: `${publicBase.replace(/\/$/, "")}/${input.objectKey}`,
      requiredHeaders: {
        "content-type": input.mimeType,
        "x-architech-media-id": input.uploadId,
        "x-architech-media-kind": kind,
      },
      expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
    };
  }

  /* Header-authored SigV4 DELETE (signRequest oracle, pinned to the AWS
     worked example): the secret stays on the server, the retention sweep
     sends a one-shot DELETE to the S3 API. 404 (already gone) counts as
     success so a double sweep is idempotent. */
  async deleteObject(objectKey: string): Promise<MediaDeleteResult> {
    const accountId = this.env.R2_ACCOUNT_ID;
    const bucket = this.env.R2_BUCKET;
    const accessKeyId = this.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = this.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
      return { ok: false, error: "R2 media storage credentials are not configured." };
    }
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${objectKey}`;
    const now = new Date();
    const signed = signRequest({
      method: "DELETE",
      url: endpoint,
      region: this.env.R2_REGION || "auto",
      service: "s3",
      accessKeyId,
      secretAccessKey,
      headers: { "x-amz-date": now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "") },
      /* Omitted on purpose: signRequest defaults to the SHA-256 of the empty
         body, which is the canonical hash S3 expects for a payload-less
         DELETE (UNSIGNED-PAYLOAD is the presigned-URL convention). */
      now,
    });
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "x-amz-date": signed.amzDate, authorization: signed.authorization },
      });
      if (res.ok || res.status === 404) return { ok: true };
      return { ok: false, status: res.status, error: `R2 DELETE failed with HTTP ${res.status}.` };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
