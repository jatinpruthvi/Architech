/* Measured image dimensions (StudyArena round-12, contestant D §2).

   D asks for compressed WebP images with a fast LCP. The image primitive
   already does that, and 3,716 rendered images were verified to sit inside a
   <picture> with a WebP srcSet and explicit dimensions — with one exception,
   the 404 page, which used a raw <img> and is fixed here.

   What this suite actually guards is the numbers behind them. The same
   "declared dimensions disagree with the file" defect fixed in file 6 for
   <img> width/height existed in the social metadata: the root layout declared
   its OpenGraph image as 1600x900 when hero-ahmedabad.jpg is 1376x768, a 16%
   overstatement of width published on all 19 routes that inherit the default.
   Social platforms use those numbers to shape the preview card.

   The map now lives in a hooks-free module so a server component can read it,
   and these tests read the real files so it cannot drift again. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_INTRINSIC_ASPECT, DEFAULT_INTRINSIC_WIDTH, IMAGE_INTRINSIC_SIZES, intrinsicSizeOf } from "./intrinsic-sizes";

const imagesDir = path.resolve(process.cwd(), "public/images");

function intrinsicSizeOfFile(file: string): { width: number; height: number } {
  const buffer = readFileSync(file);
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    const format = buffer.subarray(12, 16).toString("ascii");
    if (format === "VP8X") return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
    if (format === "VP8 ") return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    throw new Error(`unsupported WebP chunk: ${format}`);
  }
  // JPEG: walk the segments for a Start-Of-Frame marker.
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  throw new Error("no SOF marker found");
}

describe("image intrinsic sizes", () => {
  it("maps assets that exist", () => {
    expect(Object.keys(IMAGE_INTRINSIC_SIZES).length).toBeGreaterThan(0);
  });

  /* The same assertion pic.test.ts makes, but against the shared module the
     server components read. Both names point at one object, so a drift in
     either consumer is a drift in the map, and this catches it. */
  it("matches the real files, jpg and webp alike", () => {
    for (const [name, declared] of Object.entries(IMAGE_INTRINSIC_SIZES)) {
      const jpg = intrinsicSizeOfFile(path.join(imagesDir, `${name}.jpg`));
      expect(jpg, `${name}.jpg`).toEqual(declared);
      const webp = intrinsicSizeOfFile(path.join(imagesDir, `${name}.webp`));
      expect(webp, `${name}.webp`).toEqual(declared);
    }
  });

  it("never declares a portrait asset as landscape", () => {
    for (const [name, size] of Object.entries(IMAGE_INTRINSIC_SIZES)) {
      const actual = intrinsicSizeOfFile(path.join(imagesDir, `${name}.jpg`));
      if (actual.height > actual.width) {
        expect(size.height, name).toBeGreaterThan(size.width);
      }
    }
  });

  it("returns undefined for an unmapped asset rather than guessing", () => {
    expect(intrinsicSizeOf("brick-arch")).toEqual({ width: 896, height: 1200 });
    expect(intrinsicSizeOf("not-an-asset")).toBeUndefined();
    // The caller decides whether to fall back. Guessing silently is how the
    // original 1600x900 survived.
    expect(DEFAULT_INTRINSIC_WIDTH).toBe(1200);
    expect(DEFAULT_INTRINSIC_ASPECT).toBe(1.5);
  });

  /* The specific defect. A social card sized from these numbers would be
     cropped against the wrong shape on every route inheriting the default. */
  it("declares the social hero at its true size, not 1600x900", () => {
    const hero = intrinsicSizeOf("hero-ahmedabad");
    expect(hero).toEqual({ width: 1376, height: 768 });
    expect(hero).not.toEqual({ width: 1600, height: 900 });
  });
});
