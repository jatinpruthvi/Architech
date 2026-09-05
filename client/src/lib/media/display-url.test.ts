import { describe, expect, it } from "vitest";
import { mediaDisplayUrl, r2DisplayBase } from "./display-url";

const ENV = { NEXT_PUBLIC_R2_PUBLIC_BASE_URL: "https://media.architech.test" } as unknown as Record<string, string | undefined>;

describe("mediaDisplayUrl", () => {
  it("routes R2 URLs under the public base through the edge transform at the requested width", () => {
    expect(mediaDisplayUrl("https://media.architech.test/originals/listings/h1/primary.jpg", 640, ENV))
      .toBe("https://media.architech.test/img/640-auto/originals/listings/h1/primary.jpg");
  });

  it("serves absolute URLs from other origins unchanged", () => {
    expect(mediaDisplayUrl("https://cdn.other-host.net/photos/h1.jpg", 640, ENV))
      .toBe("https://cdn.other-host.net/photos/h1.jpg");
  });

  it("does not transform sibling domains that merely start with the base", () => {
    expect(mediaDisplayUrl("https://media.architech.test.evil.example/originals/h1.jpg", 640, ENV))
      .toBe("https://media.architech.test.evil.example/originals/h1.jpg");
  });

  it("returns undefined for relative paths so callers fall back to local assets", () => {
    expect(mediaDisplayUrl("/images/prop-courtyard.jpg", 640, ENV)).toBeUndefined();
    expect(mediaDisplayUrl(undefined, 640, ENV)).toBeUndefined();
    expect(mediaDisplayUrl(null, 640, ENV)).toBeUndefined();
    expect(mediaDisplayUrl("", 640, ENV)).toBeUndefined();
  });

  it("passes absolute URLs through when no public base is configured (no origin to trust)", () => {
    expect(mediaDisplayUrl("https://cdn.other-host.net/photos/h1.jpg", 640, {}))
      .toBe("https://cdn.other-host.net/photos/h1.jpg");
  });

  it("reads the public base from the given env (build-time constant)", () => {
    expect(r2DisplayBase({ NEXT_PUBLIC_R2_PUBLIC_BASE_URL: "https://m.example/" })).toBe("https://m.example");
    expect(r2DisplayBase({})).toBe("");
  });
});
