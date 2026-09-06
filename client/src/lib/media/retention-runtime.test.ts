import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runMediaRetentionSweep } from "./retention-runtime";
import { createSignedMediaUpload, getMediaUpload, moderateMedia, resetMediaStoreForTests, setMediaUploadCreatedAtForTests, type MediaUploadInput } from "./upload";

/* Prisma-mode object deletion (media-storage-decision phase 4): the sweep must
   delete the R2 OBJECT when it deletes the row. Both the DB client and the
   lifecycle helper are mocked so the test proves the wiring, not the network. */
const fake = vi.hoisted(() => {
  const state: { rows: Array<Record<string, unknown>>; updated: string[]; audit: Array<{ data: { action: string; entityId: string } }> } = { rows: [], updated: [], audit: [] };
  const getPrismaClient = () => ({
    propertyMedia: {
      findMany: vi.fn(async () => state.rows),
      updateMany: vi.fn(async ({ where }: { where: { id: string } }) => {
        state.updated.push(where.id);
        return { count: 1 };
      }),
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
    },
    auditEvent: {
      create: vi.fn(async (args: { data: { action: string; entityId: string } }) => {
        state.audit.push(args);
        return {};
      }),
    },
  });
  return { state, getPrismaClient };
});

const deleteObjectMock = vi.hoisted(() => vi.fn(async (key: string | null | undefined) => (key ? { ok: true, skipped: false } : { ok: true, skipped: true })));

vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: fake.getPrismaClient }));
vi.mock("./server/lifecycle", () => ({ deleteMediaObjectBestEffort: deleteObjectMock }));

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

  it("reports zero object work in memory mode (no objects exist there)", async () => {
    await seedAndAge(31);
    const result = await runMediaRetentionSweep();
    expect(result.objectsDeleted).toBe(0);
    expect(result.objectDeleteFailures).toBe(0);
  });
});

describe("runMediaRetentionSweep — R2 object deletion (prisma mode)", () => {
  beforeEach(() => {
    resetMediaStoreForTests();
    fake.state.rows = [];
    fake.state.updated = [];
    fake.state.audit = [];
    deleteObjectMock.mockClear();
    deleteObjectMock.mockImplementation(async (key: string | null | undefined) => (key ? { ok: true, skipped: false } : { ok: true, skipped: true }));
    process.env.ARCHITECH_DATA_SOURCE = "prisma";
  });

  afterEach(() => {
    delete process.env.ARCHITECH_DATA_SOURCE;
  });

  function seedRow(status: string, ageDays: number, objectKey: string | null, id = "media_prisma_1") {
    fake.state.rows.push({
      id,
      moderationStatus: status,
      exifStripped: false,
      createdAt: new Date(Date.now() - ageDays * 86_400_000).toISOString(),
      objectKey,
    });
    return id;
  }

  it("deletes the R2 object when it deletes an expired row", async () => {
    const id = seedRow("PENDING", 31, "listing-drafts/draft_abc/media_123/courtyard-hero.jpg");
    const result = await runMediaRetentionSweep();
    expect(result.acted).toBe(1);
    expect(result.objectsDeleted).toBe(1);
    expect(result.objectDeleteFailures).toBe(0);
    expect(deleteObjectMock).toHaveBeenCalledWith("listing-drafts/draft_abc/media_123/courtyard-hero.jpg");
    expect(fake.state.updated).toContain(id);
    expect(fake.state.audit.some((event) => event.data.action === "media.retention.enforced")).toBe(true);
  });

  it("deletes nothing for rows without an object key (legacy rows, null key)", async () => {
    seedRow("REJECTED", 15, null);
    const result = await runMediaRetentionSweep();
    expect(result.acted).toBe(1);
    // The null key is handed to the lifecycle helper, which skips it — the
    // provider is never reached for a row that has no stored object.
    expect(deleteObjectMock).toHaveBeenCalledWith(null);
    expect(result.objectsDeleted).toBe(0);
    expect(result.objectDeleteFailures).toBe(0);
  });

  it("counts and audits an object-delete failure without wedging the sweep", async () => {
    deleteObjectMock.mockImplementation(async () => ({ ok: false, skipped: false, error: "boom" }));
    const id = seedRow("TAKEDOWN_REQUESTED", 9, "listing-drafts/d/x.jpg");
    const result = await runMediaRetentionSweep();
    expect(result.acted).toBe(1);
    expect(result.objectsDeleted).toBe(0);
    expect(result.objectDeleteFailures).toBe(1);
    expect(fake.state.updated).toContain(id); // row still deleted
    expect(fake.state.audit.some((event) => event.data.action === "media.object_delete_failed")).toBe(true);
  });
});
