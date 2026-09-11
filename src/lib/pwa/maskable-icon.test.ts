import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";

/* Guards the regression this slice fixed: public/icon-512-maskable.png shipped
   as a byte-identical copy of public/icon-512.png, so declaring it maskable
   would have let an adaptive launcher crop the unpadded mark. The asset is now
   rebuilt by ops/scripts/media/generate-maskable-icon.mjs with the mark inside
   the 80% safe zone; this test only pins the facts that are cheap to assert
   without a PNG codec (the codec lives in that script, not here). */

const root = process.cwd();
const anyIcon = readFileSync(join(root, "public", "icon-512.png"));
const maskable = readFileSync(join(root, "public", "icon-512-maskable.png"));
const manifest = JSON.parse(readFileSync(join(root, "public", "manifest.webmanifest"), "utf8"));

function dimensions(buffer: Buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("maskable home-screen icon", () => {
  it("is a real asset, not a copy of the any-purpose icon", () => {
    expect(maskable.equals(anyIcon)).toBe(false);
  });

  it("is a 512x512 PNG", () => {
    expect(dimensions(maskable)).toEqual({ width: 512, height: 512 });
  });

  it("is declared in the manifest with purpose maskable", () => {
    const entry = manifest.icons.find(
      (icon: { purpose?: string }) => String(icon.purpose ?? "").includes("maskable")
    );
    expect(entry).toBeDefined();
    expect(entry.src).toBe("/icon-512-maskable.png");
  });

  it("decodes to the saturated brand mark, not the grey corrupted tile", () => {
    // The generator writes filter-0 rows, so the centre pixel is readable
    // without a PNG unfilter pass. The original bpp bug in the decoder produced
    // a grey/pink smear here; the fixed one yields the saturated saffron arch.
    let offset = 8;
    const idat: Buffer[] = [];
    while (offset < maskable.length) {
      const length = maskable.readUInt32BE(offset);
      const type = maskable.toString("ascii", offset + 4, offset + 8);
      if (type === "IDAT") idat.push(maskable.subarray(offset + 8, offset + 8 + length));
      offset += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(idat));
    const stride = 512 * 3;
    const at = 200 * (stride + 1) + 1 + 256 * 3; // (256, 200), inside the arch body
    const red = raw[at];
    const blue = raw[at + 2];
    expect(red).toBeGreaterThan(200); // saturated, not grey
    expect(red - blue).toBeGreaterThan(80);
  });

  it("keeps at least one any-purpose icon so non-maskable launchers still work", () => {
    const anyCount = manifest.icons.filter((icon: { purpose?: string }) =>
      String(icon.purpose ?? "any").includes("any")
    ).length;
    expect(anyCount).toBeGreaterThanOrEqual(1);
  });
});
