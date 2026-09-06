#!/usr/bin/env node
/* Performance audit 2026-09-06 (finding F1): attribute the universal
   first-load JS shell — the chunks shared by every route — so regressions and
   "who rode the shell?" questions have a reproducible answer.
   Reads .next/diagnostics/route-bundle-stats.json after `pnpm build:ci`.
   Advisory only: prints a report, always exits 0. */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const statsPath = path.join(root, ".next/diagnostics/route-bundle-stats.json");
if (!fs.existsSync(statsPath)) {
  console.error("Missing .next diagnostics. Run `pnpm build:ci` first.");
  process.exit(1);
}
const stats = JSON.parse(fs.readFileSync(statsPath, "utf8"));

const coverage = new Map();
for (const route of stats) {
  for (const chunkPath of route.firstLoadChunkPaths) {
    coverage.set(chunkPath, (coverage.get(chunkPath) ?? 0) + 1);
  }
}
const totalRoutes = stats.length;
const shellChunks = [...coverage.entries()]
  .filter(([, routes]) => routes === totalRoutes)
  .map(([chunkPath]) => chunkPath)
  .sort((a, b) => fs.statSync(path.join(root, b)).size - fs.statSync(path.join(root, a)).size);

const SIGNATURES = {
  "react-dom": "react-dom",
  "next router/runtime": "AppRouter",
  "scheduler (react)": "scheduler",
  "sonner (toasts)": "sonner",
  "better-auth": "better-auth",
  "radix (ui primitives)": "@radix-ui",
  "motion (animation)": "motion",
  "lucide (icons)": "lucide",
  "maplibre": "maplibre",
  "sentry": "@sentry",
  "cmdk (command menu)": "cmdk",
  "vaul (drawer)": "vaul",
  "zod": "zod",
};

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
let rawTotal = 0;
let gzipTotal = 0;
console.log(`\nUniversal first-load shell across ${totalRoutes} routes\n`);
for (const chunkPath of shellChunks) {
  const absolute = path.join(root, chunkPath);
  const raw = fs.statSync(absolute).size;
  const gzip = zlib.gzipSync(fs.readFileSync(absolute)).length;
  rawTotal += raw;
  gzipTotal += gzip;
  const src = fs.readFileSync(absolute, "utf8");
  const hits = Object.entries(SIGNATURES)
    .filter(([, needle]) => src.includes(needle))
    .map(([label]) => label);
  console.log(`- ${formatKiB(raw).padStart(9)} raw / ${formatKiB(gzip).padStart(8)} gzip  ${path.basename(chunkPath)}`);
  console.log(`    signatures: ${hits.length ? hits.join(", ") : "(no known library signature)"}`);
}
console.log(`\nShell total: ${formatKiB(rawTotal)} raw / ${formatKiB(gzipTotal)} gzip on every one of ${totalRoutes} routes.`);
console.log("Known framework floor (react-dom + next runtime chunks) cannot be split further;");
console.log("treat app-library signatures above as the only legitimate split candidates.");
console.log("Advisory report — no budget enforced here; budgets live in performance/budgets.json.");
