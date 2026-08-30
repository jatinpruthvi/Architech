import { beforeEach, describe, expect, it } from "vitest";
import { completeMediaUpload, createSignedMediaUpload, deleteMedia, getMediaUpload, moderateMedia, planDerivatives, requestMediaTakedown, resetMediaStoreForTests, validateMediaUpload } from "./upload";

const imageInput = {
  listingDraftId: "draft_abc",
  fileName: "courtyard hero.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 1_500_000,
  width: 1600,
  height: 1000,
  licenseEvidence: "Broker owns this photo and grants publication rights.",
  rightsConfirmed: true,
};

describe("media upload pipeline contract", () => {
  beforeEach(() => resetMediaStoreForTests());

  it("validates media type, size, license evidence, and rights confirmation", () => {
    expect(validateMediaUpload(imageInput)).toEqual([]);
    expect(validateMediaUpload({ ...imageInput, rightsConfirmed: false })).toContain("Media rights confirmation is required.");
    expect(validateMediaUpload({ ...imageInput, mimeType: "application/pdf" })).toContain("Unsupported media type.");
  });

  it("plans image derivatives", () => {
    expect(planDerivatives(imageInput).map((item) => item.kind)).toEqual(["original", "webp", "webp_800", "thumbnail"]);
  });

  it("creates signed uploads, completes the transfer, and moderates", () => {
    const signed = createSignedMediaUpload(imageInput);
    expect(signed.ok && signed.upload.moderationStatus).toBe("PENDING");
    if (!signed.ok) throw new Error("sign failed");
    const completed = completeMediaUpload(signed.upload.id);
    if (!completed.ok) throw new Error("complete failed");
    /* B-17: no processor is attached, so derivatives must stay `planned` and
       the audit trail must not claim EXIF was stripped. */
    expect(completed.upload.derivatives.every((d) => d.status === "planned")).toBe(true);
    expect(completed.upload.auditTrail.some((item) => item.action === "media.upload.completed" && item.metadata?.exifStripped === false)).toBe(true);
    const moderated = moderateMedia(signed.upload.id, "APPROVED", "Image rights verified.");
    expect(moderated.ok && moderated.upload.moderationStatus).toBe("APPROVED");
  });

  it("requests a takedown and then confirms deletion", () => {
    const signed = createSignedMediaUpload(imageInput);
    if (!signed.ok) throw new Error("sign failed");
    const takedown = requestMediaTakedown(signed.upload.id, "Copyright dispute.");
    expect(takedown.ok && takedown.upload.moderationStatus).toBe("TAKEDOWN_REQUESTED");
    const removed = deleteMedia(signed.upload.id);
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.id).toBe(signed.upload.id);
    expect(getMediaUpload(signed.upload.id)).toBeUndefined();
  });

  it("returns 404 for unknown takedown/delete targets", () => {
    expect(requestMediaTakedown("nope", "test").ok).toBe(false);
    expect(deleteMedia("nope").ok).toBe(false);
  });
});
