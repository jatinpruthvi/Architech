import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSignedMediaUploadForServer } from "./upload";
import { resetMediaStoreForTests, type MediaUploadInput } from "@/lib/media/upload";
import { VIDEO_GATE_ERROR } from "@/lib/media/policy";

/* The sign endpoint is the AUTHORITATIVE media policy gate
   (media-storage-decision.md phases 2 + 4a): even if the UI were bypassed,
   the server refuses gated kinds and enforces the per-listing quota. */

function imageInput(draftId = "draft_gate", file = "courtyard-hero.jpg"): MediaUploadInput {
  return {
    listingDraftId: draftId,
    fileName: file,
    mimeType: "image/jpeg",
    sizeBytes: 1_000,
    licenseEvidence: "Signed rights waiver, owner D. Shah.",
    rightsConfirmed: true,
  };
}

function videoInput(draftId = "draft_gate_video", file = "tour.mp4"): MediaUploadInput {
  return {
    ...imageInput(draftId, file),
    mimeType: "video/mp4",
    sizeBytes: 50 * 1024 * 1024,
  };
}

describe("createSignedMediaUploadForServer — media policy", () => {
  const envKeys = ["ARCHITECH_MEDIA_KINDS", "MEDIA_MAX_IMAGES_PER_LISTING"];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    resetMediaStoreForTests();
    for (const key of envKeys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("signs images under the default images-only gate", async () => {
    const result = await createSignedMediaUploadForServer(imageInput());
    expect(result.ok).toBe(true);
  });

  it("refuses video under the default images-only gate, before signing", async () => {
    const result = await createSignedMediaUploadForServer(videoInput());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.errors).toEqual([VIDEO_GATE_ERROR]);
    }
  });

  it("does not persist a gated video as a signed record", async () => {
    await createSignedMediaUploadForServer(videoInput("draft_no_leak", "leak.mp4"));
    const recheck = await createSignedMediaUploadForServer(videoInput("draft_no_leak", "leak.mp4"));
    expect(recheck.ok).toBe(false);
    // A second, valid image on the same draft must not be blocked by the
    // rejected video — the quota counts only real signed records.
    const image = await createSignedMediaUploadForServer(imageInput("draft_no_leak", "image.jpg"));
    expect(image.ok).toBe(true);
  });

  it("allows video when ARCHITECH_MEDIA_KINDS=all (retained path)", async () => {
    process.env.ARCHITECH_MEDIA_KINDS = "all";
    const result = await createSignedMediaUploadForServer(videoInput());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.upload.kind).toBe("video");
  });

  it("enforces the per-draft quota (default 10)", async () => {
    for (let i = 1; i <= 10; i += 1) {
      const result = await createSignedMediaUploadForServer(imageInput("draft_quota", `photo-${i}.jpg`));
      expect(result.ok, `upload ${i} should be allowed`).toBe(true);
    }
    const eleventh = await createSignedMediaUploadForServer(imageInput("draft_quota", "photo-11.jpg"));
    expect(eleventh.ok).toBe(false);
    if (!eleventh.ok) {
      expect(eleventh.status).toBe(409);
      expect(eleventh.errors[0]).toMatch(/10 media items/);
    }
  });

  it("quota is per draft: a different draft is unaffected", async () => {
    for (let i = 1; i <= 10; i += 1) await createSignedMediaUploadForServer(imageInput("draft_full", `p-${i}.jpg`));
    const other = await createSignedMediaUploadForServer(imageInput("draft_other", "first.jpg"));
    expect(other.ok).toBe(true);
  });

  it("honours a custom quota override", async () => {
    process.env.MEDIA_MAX_IMAGES_PER_LISTING = "2";
    await createSignedMediaUploadForServer(imageInput("draft_small", "a.jpg"));
    await createSignedMediaUploadForServer(imageInput("draft_small", "b.jpg"));
    const third = await createSignedMediaUploadForServer(imageInput("draft_small", "c.jpg"));
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.status).toBe(409);
      expect(third.errors[0]).toMatch(/2 media items/);
    }
  });

  it("re-signing the same upload does not count against its own quota", async () => {
    for (let i = 1; i <= 10; i += 1) await createSignedMediaUploadForServer(imageInput("draft_dup", `q-${i}.jpg`));
    // Duplicate sign of the 10th upload (same draft/file/size → same id).
    const duplicate = await createSignedMediaUploadForServer(imageInput("draft_dup", "q-10.jpg"));
    expect(duplicate.ok).toBe(true);
    if (duplicate.ok) expect(duplicate.duplicate).toBe(true);
  });
});
