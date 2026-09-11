import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PIC_INTRINSIC_SIZES } from "./Pic";

/* The declared width/height on an <img> is how the browser reserves space
   before the photo loads. If the declared ratio disagrees with the real file,
   the page jumps when the image lands — a direct CLS cost, and Contestant A
   §7 targets CLS below 0.1.

   DEFAULT_ASPECT used to stand in for every asset on the assumption that they
   were all cropped to 1.5. Measured, that was true of one asset in seven. These
   tests read the actual files so the map can never drift from reality again. */

function intrinsicSizeOf(file: string): { width: number; height: number } {
  const buffer = readFileSync(file);

  // WebP: VP8X (extended) carries canvas size; VP8 (lossy) carries it in the frame header.
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    const format = buffer.subarray(12, 16).toString("ascii");
    if (format === "VP8X") {
      return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
    }
    if (format === "VP8 ") {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
  }

  // JPEG: walk the segments to the SOF0/SOF1/SOF2 frame header.
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }

  throw new Error(`Unsupported or unreadable image: ${file}`);
}

const imagesDir = path.join(process.cwd(), "public", "images");

describe("Pic intrinsic dimensions", () => {
  it("declares the real dimensions of every mapped image", () => {
    const entries = Object.entries(PIC_INTRINSIC_SIZES);
    expect(entries.length).toBeGreaterThan(0);

    for (const [name, declared] of entries) {
      const actual = intrinsicSizeOf(path.join(imagesDir, `${name}.jpg`));
      expect(
        { name, ...declared },
        `${name}: declared ${declared.width}x${declared.height} but the file is ${actual.width}x${actual.height}`,
      ).toEqual({ name, ...actual });
    }
  });

  it("declares the same ratio as the webp derivative shipped in srcset", () => {
    // The <source type="image/webp"> is what modern browsers actually download,
    // so a mismatch between the jpg and webp derivatives would still shift.
    for (const [name, declared] of Object.entries(PIC_INTRINSIC_SIZES)) {
      const webp = intrinsicSizeOf(path.join(imagesDir, `${name}.webp`));
      expect(webp.width / webp.height).toBeCloseTo(declared.width / declared.height, 3);
    }
  });

  it("never declares a portrait asset as landscape", () => {
    // The regression this suite exists for: brick-arch and stepwell are
    // 896x1200 portrait and were being declared 896x597 landscape.
    for (const [name, declared] of Object.entries(PIC_INTRINSIC_SIZES)) {
      const actual = intrinsicSizeOf(path.join(imagesDir, `${name}.jpg`));
      const declaredLandscape = declared.width > declared.height;
      const actualLandscape = actual.width > actual.height;
      expect(declaredLandscape, `${name} orientation mismatch`).toBe(actualLandscape);
    }
  });
});
