#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const budgets = JSON.parse(fs.readFileSync(path.join(root, "performance/budgets.json"), "utf8"));
const routeStatsPath = path.join(root, ".next/diagnostics/route-bundle-stats.json");

function fail(message) {
  failures.push(message);
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function sizeOf(file) {
  return fs.statSync(path.join(root, file)).size;
}

function gzipSizeOf(file) {
  return zlib.gzipSync(fs.readFileSync(path.join(root, file))).length;
}

function listFiles(dir, predicate) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(rel, predicate));
    else if (!predicate || predicate(rel)) files.push(rel);
  }
  return files;
}

const failures = [];

if (!fs.existsSync(routeStatsPath)) {
  throw new Error("Missing .next diagnostics. Run `next build` before performance budget checks.");
}

const routeStats = JSON.parse(fs.readFileSync(routeStatsPath, "utf8"));
console.log("\nRoute JavaScript budgets");
for (const route of routeStats) {
  const routeBudget = budgets.routes[route.route] ?? budgets.routes.default;
  const gzipBytes = route.firstLoadChunkPaths.reduce((sum, chunkPath) => sum + gzipSizeOf(chunkPath), 0);
  console.log(`- ${route.route}: ${formatBytes(route.firstLoadUncompressedJsBytes)} raw / ${formatBytes(gzipBytes)} gzip`);
  if (route.firstLoadUncompressedJsBytes > routeBudget.maxFirstLoadJsBytes) {
    fail(`${route.route} first-load JS ${formatBytes(route.firstLoadUncompressedJsBytes)} exceeds budget ${formatBytes(routeBudget.maxFirstLoadJsBytes)}`);
  }
  if (gzipBytes > routeBudget.maxFirstLoadJsGzipBytes) {
    fail(`${route.route} first-load JS gzip ${formatBytes(gzipBytes)} exceeds budget ${formatBytes(routeBudget.maxFirstLoadJsGzipBytes)}`);
  }
}

console.log("\nHTML budgets");
for (const item of budgets.html.routes) {
  if (!fs.existsSync(path.join(root, item.file))) {
    fail(`${item.route} HTML artifact missing at ${item.file}`);
    continue;
  }
  const bytes = sizeOf(item.file);
  console.log(`- ${item.route}: ${formatBytes(bytes)}`);
  if (bytes > budgets.html.maxHtmlBytes) {
    fail(`${item.route} HTML ${formatBytes(bytes)} exceeds budget ${formatBytes(budgets.html.maxHtmlBytes)}`);
  }
}

const jsChunks = listFiles(".next/static/chunks", (file) => file.endsWith(".js"));
const totalStaticJsBytes = jsChunks.reduce((sum, file) => sum + sizeOf(file), 0);
const largestChunk = jsChunks
  .map((file) => ({ file, bytes: sizeOf(file), gzipBytes: gzipSizeOf(file) }))
  .sort((a, b) => b.bytes - a.bytes)[0];

console.log("\nStatic asset budgets");
console.log(`- total .next static JS: ${formatBytes(totalStaticJsBytes)}`);
console.log(`- largest JS chunk: ${largestChunk.file} ${formatBytes(largestChunk.bytes)} raw / ${formatBytes(largestChunk.gzipBytes)} gzip`);
if (totalStaticJsBytes > budgets.staticAssets.maxTotalStaticJsBytes) {
  fail(`Total static JS ${formatBytes(totalStaticJsBytes)} exceeds budget ${formatBytes(budgets.staticAssets.maxTotalStaticJsBytes)}`);
}
if (largestChunk.bytes > budgets.staticAssets.maxLargestChunkBytes) {
  fail(`Largest JS chunk ${formatBytes(largestChunk.bytes)} exceeds budget ${formatBytes(budgets.staticAssets.maxLargestChunkBytes)}`);
}
if (largestChunk.gzipBytes > budgets.staticAssets.maxLargestChunkGzipBytes) {
  fail(`Largest JS chunk gzip ${formatBytes(largestChunk.gzipBytes)} exceeds budget ${formatBytes(budgets.staticAssets.maxLargestChunkGzipBytes)}`);
}

const images = listFiles("public/images", (file) => /\.(jpe?g|webp)$/i.test(file));
for (const file of images) {
  const bytes = sizeOf(file);
  const isMobileWebp = /-800\.webp$/i.test(file);
  const isWebp = /\.webp$/i.test(file);
  const max = isMobileWebp
    ? budgets.staticAssets.maxMobileWebpBytes
    : isWebp
      ? budgets.staticAssets.maxFullWebpBytes
      : budgets.staticAssets.maxJpegBytes;
  if (bytes > max) {
    fail(`${file} ${formatBytes(bytes)} exceeds image budget ${formatBytes(max)}`);
  }
}
console.log(`- checked ${images.length} local JPG/WebP image assets`);

console.log("\nCore Web Vitals targets");
console.log(`- LCP ≤ ${budgets.coreWebVitalsTargets.lcpMs}ms`);
console.log(`- INP ≤ ${budgets.coreWebVitalsTargets.inpMs}ms`);
console.log(`- CLS ≤ ${budgets.coreWebVitalsTargets.cls}`);
console.log(`- TTFB ≤ ${budgets.coreWebVitalsTargets.ttfbMs}ms`);

if (failures.length) {
  console.error("\nPerformance budget failed:");
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}

console.log("\nPerformance budgets passed.");
