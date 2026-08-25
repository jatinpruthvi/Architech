import type { MediaUploadInput } from "./upload";
import { detectMediaKind } from "./upload";

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

export interface MediaStorageProvider {
  id: MediaStorageProviderId;
  signUpload(input: MediaSignRequest): Promise<MediaSignResult>;
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
}

export class R2MediaStorageProvider implements MediaStorageProvider {
  id = "cloudflare-r2" as const;

  constructor(private env: NodeJS.ProcessEnv = process.env) {}

  async signUpload(input: MediaSignRequest): Promise<MediaSignResult> {
    const accountId = this.env.R2_ACCOUNT_ID;
    const bucket = this.env.R2_BUCKET;
    const publicBase = this.env.R2_PUBLIC_BASE_URL;
    if (!accountId || !bucket || !publicBase) throw new Error("R2 media storage is not configured.");
    const kind = detectMediaKind(input.mimeType) ?? "image";
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${input.objectKey}`;
    return {
      provider: this.id,
      // Placeholder PUT URL contract until provider SDK signing is enabled with real credentials.
      uploadUrl: `${endpoint}?signed=placeholder&expiresIn=900`,
      publicUrl: `${publicBase.replace(/\/$/, "")}/${input.objectKey}`,
      requiredHeaders: {
        "content-type": input.mimeType,
        "x-architech-media-id": input.uploadId,
        "x-architech-media-kind": kind,
      },
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }
}
