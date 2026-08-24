import "server-only";
import { createSignedMediaUpload, type MediaUploadInput } from "@/lib/media/upload";
import { MemoryMediaStorageProvider, mediaObjectKey, R2MediaStorageProvider, type MediaStorageProvider } from "@/lib/media/provider";
import { getMediaStorageMode, validateR2Environment } from "@/lib/media/source";

export function getMediaStorageProvider(mode = getMediaStorageMode()): MediaStorageProvider {
  if (mode === "r2") {
    const env = validateR2Environment();
    if (!env.ok) throw new Error(`R2 media storage is missing: ${env.missing.join(", ")}`);
    return new R2MediaStorageProvider();
  }
  return new MemoryMediaStorageProvider();
}

export async function createSignedMediaUploadForServer(input: MediaUploadInput) {
  const result = createSignedMediaUpload(input);
  if (!result.ok) return result;

  const provider = getMediaStorageProvider();
  const objectKey = mediaObjectKey(input, result.upload.id);
  const signed = await provider.signUpload({ ...input, uploadId: result.upload.id, objectKey });

  return {
    ...result,
    upload: {
      ...result.upload,
      uploadUrl: signed.uploadUrl,
      publicUrl: signed.publicUrl,
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
