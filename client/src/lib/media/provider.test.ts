import { afterEach, describe, expect, it, vi } from "vitest";
import { mediaObjectKey, MemoryMediaStorageProvider, R2MediaStorageProvider } from "./provider";
import { getMediaStorageMode, validateR2Environment } from "./source";

const r2Env = { R2_ACCOUNT_ID: "account", R2_BUCKET: "bucket", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_PUBLIC_BASE_URL: "https://media.example.com" } as unknown as NodeJS.ProcessEnv;

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

describe("deleteObject (retention / takedown object deletion, media decision phase 4)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockFetch = (status: number) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: status < 400, status } as Response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("memory mode is a no-op (no object ever existed)", async () => {
    await expect(new MemoryMediaStorageProvider().deleteObject("listing-drafts/x/y/z.jpg")).resolves.toEqual({ ok: true });
  });

  it("sends a SigV4-signed DELETE to the R2 S3 API on 204", async () => {
    const fetchMock = mockFetch(204);
    const result = await new R2MediaStorageProvider(r2Env).deleteObject("listing-drafts/draft_abc/media_123/courtyard-hero.jpg");
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://account.r2.cloudflarestorage.com/bucket/listing-drafts/draft_abc/media_123/courtyard-hero.jpg");
    expect(init.method).toBe("DELETE");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=key\//);
    expect(headers["x-amz-date"]).toMatch(/^\d{8}T\d{6}Z$/);
  });

  it("treats 404 (already gone) as success so sweeps are idempotent", async () => {
    mockFetch(404);
    await expect(new R2MediaStorageProvider(r2Env).deleteObject("listing-drafts/x.jpg")).resolves.toEqual({ ok: true });
  });

  it("reports a hard failure (500) with the status", async () => {
    mockFetch(500);
    const result = await new R2MediaStorageProvider(r2Env).deleteObject("listing-drafts/x.jpg");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(500);
  });

  it("surfaces a network error as a failure, not a throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket hang up")));
    const result = await new R2MediaStorageProvider(r2Env).deleteObject("listing-drafts/x.jpg");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/socket hang up/);
  });

  it("fails closed when credentials are missing", async () => {
    const fetchMock = mockFetch(204);
    const env = { R2_ACCOUNT_ID: "account", R2_BUCKET: "bucket", R2_PUBLIC_BASE_URL: "https://media.example.com" } as unknown as NodeJS.ProcessEnv;
    const result = await new R2MediaStorageProvider(env).deleteObject("listing-drafts/x.jpg");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/credentials/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
