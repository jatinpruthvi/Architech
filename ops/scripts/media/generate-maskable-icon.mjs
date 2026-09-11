#!/usr/bin/env node
/* Generate a real maskable home-screen icon.

   WHY THIS EXISTS

   `public/icon-512-maskable.png` shipped as a byte-identical copy of
   `public/icon-512.png` (md5 b3f86596… for both), so declaring
   `purpose: "maskable"` on it would have handed launchers an unpadded mark and
   let an adaptive-icon mask crop the arch. The manifest therefore declared
   `purpose: "any"` only, and the file was dead weight that looked like
   something it was not.

   A maskable icon must keep its subject inside the central 80% safe zone
   (https://w3c.github.io/manifest/#maskable-icons). This script rebuilds the
   512px icon on a solid `background_color` canvas with the mark scaled to
   exactly 80%, bilinearly resampled.

   STDLIB ONLY, on purpose: the repo's ops scripts run without a dependency
   install (ops/scripts/AGENTS.md), and pulling an image library in to write one
   PNG would be the opposite of that. The source is a non-interlaced 16-bit
   RGB PNG with a single IDAT chunk, which is all this decoder supports — it
   fails loudly on anything else rather than silently producing a wrong icon.

   Usage:  node ops/scripts/media/generate-maskable-icon.mjs
   Output: public/icon-512-maskable.png (512x512, 8-bit RGB) */

import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SOURCE = path.join(root, "public", "icon-512.png");
const TARGET = path.join(root, "public", "icon-512-maskable.png");
const MANIFEST = path.join(root, "public", "manifest.webmanifest");
const SIZE = 512;
/* The maskable safe zone: content must stay inside the central 80%. */
const SAFE_RATIO = 0.8;

function fail(message) {
  console.error(`[generate-maskable-icon] ${message}`);
  process.exit(1);
}

/** Walk the chunk list; returns { type, data } in file order. */
function readChunks(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) fail("source is not a PNG");
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  return chunks;
}

/** Decode a non-interlaced truecolour PNG to 8-bit RGB triples. */
function decodeRgb(file) {
  const buffer = readFileSync(file);
  const chunks = readChunks(buffer);
  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) fail("PNG has no IHDR");
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const interlace = ihdr.data[12];
  if (interlace !== 0) fail("interlaced PNGs are not supported");
  if (colorType !== 2) fail(`colour type ${colorType} is not supported (need 2 = truecolour RGB)`);
  if (depth !== 8 && depth !== 16) fail(`bit depth ${depth} is not supported`);

  const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
  const raw = inflateSync(idat);

  const bytesPerSample = depth / 8;
  const stride = width * 3 * bytesPerSample;
  /* PNG filters address the LEFT neighbour in bytes-per-complete-pixel, not
     bytes-per-sample: 16-bit RGB has a 6-byte pixel, so Sub/Average/Paeth look
     back 6 bytes. Using the sample stride (2) here corrupts every Sub row —
     this was caught in review and is pinned by the maskable-icon test. */
  const bytesPerPixel = 3 * bytesPerSample;
  const out = Buffer.alloc(width * height * 3);
  /* The previous row, in filtered-byte form, is what the sub/up/average/paeth
     filters reconstruct against. */
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const current = Buffer.from(line);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let value = current[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0) fail(`unknown PNG filter ${filter} on row ${y}`);
      current[x] = value & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        const at = x * 3 * bytesPerSample + channel * bytesPerSample;
        /* 16-bit samples are big-endian; /257 maps 0xffff onto 0xff exactly. */
        const sample = bytesPerSample === 2 ? (current[at] << 8) | current[at + 1] : current[at] * 257;
        out[(y * width + x) * 3 + channel] = Math.round(sample / 257);
      }
    }
    previous = current;
  }
  return { width, height, rgb: out };
}

function paeth(left, up, upLeft) {
  const initial = left + up - upLeft;
  const distanceLeft = Math.abs(initial - left);
  const distanceUp = Math.abs(initial - up);
  const distanceUpLeft = Math.abs(initial - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
  return distanceUp <= distanceUpLeft ? up : upLeft;
}

/** Bilinear sample of the decoded source at fractional pixel coordinates. */
function sampleBilinear(image, fx, fy) {
  const x0 = Math.min(image.width - 1, Math.max(0, Math.floor(fx)));
  const y0 = Math.min(image.height - 1, Math.max(0, Math.floor(fy)));
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const dx = Math.min(1, Math.max(0, fx - x0));
  const dy = Math.min(1, Math.max(0, fy - y0));
  const channels = [];
  for (let c = 0; c < 3; c += 1) {
    const topLeft = image.rgb[(y0 * image.width + x0) * 3 + c];
    const topRight = image.rgb[(y0 * image.width + x1) * 3 + c];
    const bottomLeft = image.rgb[(y1 * image.width + x0) * 3 + c];
    const bottomRight = image.rgb[(y1 * image.width + x1) * 3 + c];
    const top = topLeft + (topRight - topLeft) * dx;
    const bottom = bottomLeft + (bottomRight - bottomLeft) * dx;
    channels.push(Math.round(top + (bottom - top) * dy));
  }
  return channels;
}

/* --- PNG encoding (8-bit RGB, no interlace, filter 0 per row) -------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function parseHexColor(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(value).trim());
  if (!match) fail(`background_color "${value}" is not a 6-digit hex colour`);
  return [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16));
}

/* --- run ------------------------------------------------------------------ */

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const background = parseHexColor(manifest.background_color);
const source = decodeRgb(SOURCE);
if (source.width !== SIZE || source.height !== SIZE) fail(`expected a ${SIZE}px source, got ${source.width}x${source.height}`);

const inner = Math.round(SIZE * SAFE_RATIO);
const offset = (SIZE - inner) / 2;
const canvas = Buffer.alloc(SIZE * SIZE * 3);

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const index = (y * SIZE + x) * 3;
    const inside = x >= offset && x < offset + inner && y >= offset && y < offset + inner;
    if (!inside) {
      canvas[index] = background[0];
      canvas[index + 1] = background[1];
      canvas[index + 2] = background[2];
      continue;
    }
    const sample = sampleBilinear(source, ((x - offset) * source.width) / inner, ((y - offset) * source.height) / inner);
    canvas[index] = sample[0];
    canvas[index + 1] = sample[1];
    canvas[index + 2] = sample[2];
  }
}

const png = encodePng(SIZE, SIZE, canvas);
writeFileSync(TARGET, png);

/* Self-verification, printed so a bad run is visible in CI logs: the corners
   must be pure background (that is the whole point of the padding) and the
   centre must not be. */
const corner = canvas.subarray(0, 3);
const centreIndex = ((SIZE >> 1) * SIZE + (SIZE >> 1)) * 3;
const centre = canvas.subarray(centreIndex, centreIndex + 3);
const backgroundMatches = corner[0] === background[0] && corner[1] === background[1] && corner[2] === background[2];
const centreDiffers = centre[0] !== background[0] || centre[1] !== background[1] || centre[2] !== background[2];
let drawnPixels = 0;
for (let i = 0; i < SIZE * SIZE; i += 1) {
  const at = i * 3;
  if (canvas[at] !== background[0] || canvas[at + 1] !== background[1] || canvas[at + 2] !== background[2]) drawnPixels += 1;
}

console.log(
  `[generate-maskable-icon] ${path.relative(root, TARGET)} ${SIZE}x${SIZE} ` +
    `safe zone ${inner}px (offset ${offset}px, ${SAFE_RATIO * 100}%) ` +
    `background #${background.map((c) => c.toString(16).padStart(2, "0")).join("")} ` +
    `drawn pixels ${(drawnPixels / (SIZE * SIZE) * 100).toFixed(1)}% ` +
    `${png.byteLength} bytes`
);

if (!backgroundMatches) fail("corner pixel is not the background colour — the padding is wrong");
if (!centreDiffers) fail("centre pixel equals the background — the mark did not render");
console.log("[generate-maskable-icon] corner and centre pixels verified");
