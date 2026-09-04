#!/usr/bin/env node
/* `pnpm test:seo` entry point.
 *
 * The raw-HTML smoke suite asserts FIXTURE registry identities — fixture
 * listing titles, prices, dossier fields, fixture sitemap URLs — because CI
 * builds with no .env and no ARCHITECH_DATA_SOURCE, i.e. fixture mode. A
 * local checkout whose .env sets ARCHITECH_DATA_SOURCE=prisma would otherwise
 * build the public corpus from seed rows (which legitimately carry LESS
 * dossier detail — unset fields are omitted from JSON-LD by design) and fail
 * fixture-identity assertions for the wrong reason.
 *
 * This wrapper pins fixture mode for BOTH the build and the smoke server so
 * local and CI runs agree. Prisma/listings-integration coverage lives in
 * `pnpm db:validate`, the RLS proof, and the crawler; this suite stays a
 * contract test over the static corpus. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/* Pin an EMPTY value rather than deleting: Next hydrates absent variables
   from .env at build AND runtime, so deleting would let a local prisma
   `ARCHITECH_DATA_SOURCE` win again. An empty string survives node spawn
   (pnpm strips empties, node doesn't), blocks .env hydration, and resolves
   to fixture mode in `getDataSourceMode`. */
process.env.ARCHITECH_DATA_SOURCE = "";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const run = (command, args) =>
  spawnSync(command, args, { cwd: root, stdio: "inherit", env: process.env, shell: process.platform === "win32" });

let result = run(pnpm, ["build:ci"]);
if (result.status !== 0) process.exit(result.status ?? 1);

result = run(process.execPath, [path.join(root, "scripts/seo/raw-html-smoke.mjs")]);
if (result.status !== 0) process.exit(result.status ?? 1);
