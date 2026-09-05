import { describe, expect, it } from "vitest";
import { mediaObjectKey, MemoryMediaStorageProvider, R2MediaStorageProvider } from "./provider";
import { getMediaStorageMode, validateR2Environment } from "./source";

const input = {
  listingDraftId: "draft_abc",
  fileName: "Courtyard Hero.JPG",
  mimeType: "image/jpeg",
  sizeBytes: 1_000,
  licenseEvidence: "Broker owns this image.",
  rightsConfirmed: true,
  uploadId: "media_123",
  objectKey: "listing-drafts/draft_abc/media_123/courtyard-hero.jpg",
};

describe("media storage providers", () => {
  it("builds deterministic object keys", () => {
    expect(mediaObjectKey(input, input.uploadId)).toBe("listing-drafts/draft_abc/media_123/courtyard-hero.jpg");
  });

  it("defaults media storage to memory", () => {
    expect(getMediaStorageMode(undefined)).toBe("memory");
    expect(getMediaStorageMode("r2")).toBe("r2");
  });

  it("signs memory uploads", async () => {
    const signed = await new MemoryMediaStorageProvider().signUpload(input);
    expect(signed.provider).toBe("memory");
    expect(signed.requiredHeaders["x-architech-media-id"]).toBe("media_123");
  });

  it("issues a real SigV4-presigned R2 PUT URL", async () => {
    const env = { R2_ACCOUNT_ID: "account", R2_BUCKET: "bucket", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_PUBLIC_BASE_URL: "https://media.example.com" } as unknown as NodeJS.ProcessEnv;
    expect(validateR2Environment(env).ok).toBe(true);
    const signed = await new R2MediaStorageProvider(env).signUpload(input);
    expect(signed.provider).toBe("cloudflare-r2");
    const url = new URL(signed.uploadUrl);
    expect(url.host).toBe("account.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/bucket/listing-drafts/draft_abc/media_123/courtyard-hero.jpg");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-Credential")).toContain("key/");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(signed.uploadUrl).not.toContain("placeholder");
    expect(signed.publicUrl).toBe("https://media.example.com/listing-drafts/draft_abc/media_123/courtyard-hero.jpg");
  });

  it("fails closed when R2 credentials are missing instead of faking a signed URL", async () => {
    const env = { R2_ACCOUNT_ID: "account", R2_BUCKET: "bucket", R2_PUBLIC_BASE_URL: "https://media.example.com" } as unknown as NodeJS.ProcessEnv;
    await expect(new R2MediaStorageProvider(env).signUpload(input)).rejects.toThrow(/credentials/i);
  });

  it("honours an explicit R2_REGION override without breaking the default auto", async () => {
    const env = { R2_ACCOUNT_ID: "account", R2_BUCKET: "bucket", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_PUBLIC_BASE_URL: "https://media.example.com", R2_REGION: "weur" } as unknown as NodeJS.ProcessEnv;
    const signed = await new R2MediaStorageProvider(env).signUpload(input);
    expect(new URL(signed.uploadUrl).searchParams.get("X-Amz-Credential")).toBe(`key/${signed.expiresAt.slice(0, 10).replace(/-/g, "")}/weur/s3/aws4_request`);
  });
});
