import { beforeEach, describe, expect, it } from "vitest";
import { runMediaRetentionSweep } from "./retention-runtime";
import { createSignedMediaUpload, getMediaUpload, moderateMedia, resetMediaStoreForTests, setMediaUploadCreatedAtForTests, type MediaUploadInput } from "./upload";

/* M-6: the retention policy (retention.ts) used to be exercised only by tests.
   These prove the runtime sweep actually applies it to live records. */

const mediaInput: MediaUploadInput = {
  listingDraftId: "draft_abc",
  fileName: "courtyard hero.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 2_400_000,
  licenseEvidence: "Signed rights waiver, owner D. Shah, 2026-01-10.",
  rightsConfirmed: true,
};

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function seedAndAge(ageDays: number) {
  const signed = createSignedMediaUpload(mediaInput);
  if (!signed.ok) throw new Error("upload failed");
  setMediaUploadCreatedAtForTests(signed.upload.id, daysAgo(ageDays));
  return signed.upload.id;
}

describe("runMediaRetentionSweep", () => {
  beforeEach(() => resetMediaStoreForTests());

  it("removes pending media after the 30-day window", async () => {
    const id = await seedAndAge(31);
    const result = await runMediaRetentionSweep();
    expect(result.acted).toBe(1);
    expect(result.actedIds).toContain(id);
    expect(getMediaUpload(id)?.moderationStatus).toBe("DELETED");
  });

  it("keeps pending media inside the window", async () => {
    const id = await seedAndAge(1);
    const result = await runMediaRetentionSweep();
    expect(result.acted).toBe(0);
    expect(getMediaUpload(id)?.moderationStatus).toBe("PENDING");
  });

  it("removes rejected media after 14 days", async () => {
    const id = await seedAndAge(2);
    moderateMedia(id, "REJECTED", "Not suitable.");
    setMediaUploadCreatedAtForTests(id, daysAgo(15));
    await runMediaRetentionSweep();
    expect(getMediaUpload(id)?.moderationStatus).toBe("DELETED");
  });

  it("deletes takedown-requested media after the 7-day holding window", async () => {
    const id = await seedAndAge(2);
    moderateMedia(id, "TAKEDOWN_REQUESTED", "Rights withdrawn.");
    setMediaUploadCreatedAtForTests(id, daysAgo(9));
    await runMediaRetentionSweep();
    expect(getMediaUpload(id)?.moderationStatus).toBe("DELETED");
  });

  it("retains approved media while the listing is live", async () => {
    const id = await seedAndAge(10);
    moderateMedia(id, "APPROVED", "Rights confirmed.");
    const result = await runMediaRetentionSweep();
    expect(result.acted).toBe(0);
    expect(getMediaUpload(id)?.moderationStatus).toBe("APPROVED");
  });

  it("is idempotent — an already-removed record is not acted on twice", async () => {
    const id = await seedAndAge(40);
    await runMediaRetentionSweep();
    expect(getMediaUpload(id)?.moderationStatus).toBe("DELETED");
    // DELETED has no policy → retain; the record is not revisited.
    const second = await runMediaRetentionSweep();
    expect(second.acted).toBe(0);
  });
});
