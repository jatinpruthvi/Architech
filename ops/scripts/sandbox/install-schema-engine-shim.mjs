#!/usr/bin/env node
/* Install the sandbox schema-engine shim so `prisma validate` can run with no
   network access.

   Why this exists (bug-hunt round 4, backlog item N7): `pnpm db:validate`
   downloads Prisma's native `schema-engine` from binaries.prisma.sh. In a
   network-restricted sandbox that TLS call fails and the gate reports an
   infrastructure error instead of a schema verdict — which previous hunt rounds
   recorded as "gate blocked", losing the check entirely.

   The repo already ships the stand-in at ops/scripts/sandbox/schema-engine-shim.cjs,
   but until now it was only installed as a side effect of the full local-DB
   setup (`setup-local-db.mjs`), so a hunt that only needs `validate` had to
   either run the whole DB bootstrap or copy the file by hand.

   Idempotent and non-destructive: if a schema-engine binary that actually
   executes is already present, this does nothing. It never overwrites a real
   engine.

   Usage:
     node ops/scripts/sandbox/install-schema-engine-shim.mjs
     pnpm db:validate:offline        # shim (if needed) + prisma validate
*/
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const SHIM_SRC = path.join(here, "schema-engine-shim.cjs");

function enginesDir() {
  const req = createRequire(import.meta.url);
  const prismaPkg = req.resolve("prisma/package.json");
  const prismaReq = createRequire(path.join(path.dirname(prismaPkg), "noop.js"));
  const enginesPkg = prismaReq.resolve("@prisma/engines/package.json");
  return path.dirname(enginesPkg);
}

function runs(file) {
  try {
    const r = spawnSync(file, ["--version"], { stdio: "pipe", timeout: 15000 });
    return r.status === 0 && String(r.stdout).trim().length > 0;
  } catch {
    return false;
  }
}

function main() {
  if (!fs.existsSync(SHIM_SRC)) {
    console.error(`shim source not found at ${path.relative(repoRoot, SHIM_SRC)}`);
    process.exit(1);
  }

  let dir;
  try {
    dir = enginesDir();
  } catch (error) {
    console.error(`could not resolve @prisma/engines — run \`pnpm install\` first.\n${error.message}`);
    process.exit(1);
  }

  const existing = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("schema-engine-") && !f.endsWith(".sha256"))
    .map((f) => path.join(dir, f));

  const usable = existing.find((f) => runs(f));
  if (usable) {
    console.log(`schema-engine already present (${path.basename(usable)}) — nothing to do`);
    return;
  }

  /* Prefer overwriting the platform-named placeholder the CLI expects, so the
     resolved filename matches what Prisma looks for on this machine. */
  const target = existing[0] ?? path.join(dir, "schema-engine-debian-openssl-3.0.x");
  fs.copyFileSync(SHIM_SRC, target);
  fs.chmodSync(target, 0o755);

  if (!runs(target)) {
    console.error(`installed shim at ${path.relative(repoRoot, target)} but it does not execute`);
    process.exit(1);
  }

  const version = spawnSync(target, ["--version"], { stdio: "pipe", timeout: 15000 });
  console.log(`shim installed at ${path.relative(repoRoot, target)}`);
  console.log(`  ${String(version.stdout).trim()}`);
  console.log("  supports: validate / migrate deploy / diagnoseMigrationHistory");
  console.log("  does NOT support: migrate dev / db push / createMigration");
}

main();
