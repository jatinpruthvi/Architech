import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_ITEMS_PER_LISTING, getMediaKindGate, getMediaQuota, isKindUploadAllowed, VIDEO_GATE_ERROR } from "./policy";

/* media-storage-decision.md phase 2 (images-only gate) + phase 4a (quota):
   the video code path stays in place, disabled at the gate. */

describe("getMediaKindGate", () => {
  it("defaults to images-only when the env is absent", () => {
    expect(getMediaKindGate(undefined)).toBe("images");
    expect(getMediaKindGate("")).toBe("images");
  });

  it("is explicit and case/whitespace tolerant", () => {
    expect(getMediaKindGate("images")).toBe("images");
    expect(getMediaKindGate("ALL")).toBe("all");
    expect(getMediaKindGate(" all ")).toBe("all");
  });

  it("falls back to images for unknown values (safer default)", () => {
    expect(getMediaKindGate("video")).toBe("images");
    expect(getMediaKindGate("bogus")).toBe("images");
  });
});

describe("isKindUploadAllowed", () => {
  it("always allows images", () => {
    expect(isKindUploadAllowed("images", "image")).toBe(true);
    expect(isKindUploadAllowed("all", "image")).toBe(true);
  });

  it("blocks video under the images gate and allows it under all", () => {
    expect(isKindUploadAllowed("images", "video")).toBe(false);
    expect(isKindUploadAllowed("all", "video")).toBe(true);
  });

  it("rejects unknown kinds in every mode", () => {
    expect(isKindUploadAllowed("images", undefined)).toBe(false);
    expect(isKindUploadAllowed("all", undefined)).toBe(false);
  });

  it("has a stable, user-facing gate message", () => {
    expect(VIDEO_GATE_ERROR).toMatch(/video/i);
    expect(VIDEO_GATE_ERROR).toMatch(/images only/i);
  });
});

describe("getMediaQuota", () => {
  it("defaults to 10 items per listing", () => {
    expect(DEFAULT_MAX_ITEMS_PER_LISTING).toBe(10);
    expect(getMediaQuota({})).toEqual({ maxItemsPerListing: 10 });
  });

  it("honours a valid override", () => {
    expect(getMediaQuota({ MEDIA_MAX_IMAGES_PER_LISTING: "5" })).toEqual({ maxItemsPerListing: 5 });
  });

  it("floors fractional values", () => {
    expect(getMediaQuota({ MEDIA_MAX_IMAGES_PER_LISTING: "4.9" })).toEqual({ maxItemsPerListing: 4 });
  });

  it("falls back to the default for invalid values instead of unbounding", () => {
    expect(getMediaQuota({ MEDIA_MAX_IMAGES_PER_LISTING: "0" })).toEqual({ maxItemsPerListing: 10 });
    expect(getMediaQuota({ MEDIA_MAX_IMAGES_PER_LISTING: "-3" })).toEqual({ maxItemsPerListing: 10 });
    expect(getMediaQuota({ MEDIA_MAX_IMAGES_PER_LISTING: "abc" })).toEqual({ maxItemsPerListing: 10 });
    expect(getMediaQuota({ MEDIA_MAX_IMAGES_PER_LISTING: "" })).toEqual({ maxItemsPerListing: 10 });
  });
});
