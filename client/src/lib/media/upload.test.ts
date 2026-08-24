import { beforeEach, describe, expect, it } from "vitest";
import { POST as signRoute } from "../../../../app/api/media/uploads/sign/route";
import { POST as completeRoute } from "../../../../app/api/media/uploads/[uploadId]/complete/route";
import { POST as moderateRoute } from "../../../../app/api/admin/media/[uploadId]/moderate/route";
import { completeMediaUpload, createSignedMediaUpload, moderateMedia, planDerivatives, resetMediaStoreForTests, validateMediaUpload } from "./upload";

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

  it("creates signed uploads, completes derivatives, and moderates", () => {
    const signed = createSignedMediaUpload(imageInput);
    expect(signed.ok && signed.upload.moderationStatus).toBe("PENDING");
    if (!signed.ok) throw new Error("sign failed");
    const completed = completeMediaUpload(signed.upload.id);
    expect(completed.ok && completed.upload.derivatives.every((d) => d.status === "ready")).toBe(true);
    const moderated = moderateMedia(signed.upload.id, "APPROVED", "Image rights verified.");
    expect(moderated.ok && moderated.upload.moderationStatus).toBe("APPROVED");
  });

  it("exposes API route contracts", async () => {
    const signedResponse = await signRoute(new Request("http://example.com/api/media/uploads/sign", { method: "POST", body: JSON.stringify(imageInput) }));
    expect(signedResponse.status).toBe(201);
    const signed = await signedResponse.json();

    const completeResponse = await completeRoute(new Request("http://example.com"), { params: Promise.resolve({ uploadId: signed.upload.id }) });
    expect(completeResponse.status).toBe(200);

    const moderateResponse = await moderateRoute(new Request("http://example.com", { method: "POST", body: JSON.stringify({ status: "APPROVED", reason: "Rights verified." }) }), { params: Promise.resolve({ uploadId: signed.upload.id }) });
    const moderated = await moderateResponse.json();
    expect(moderated.upload.moderationStatus).toBe("APPROVED");
  });
});
