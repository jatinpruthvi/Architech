#!/usr/bin/env node
/* Runs every end-to-end suite against the current production build.
 *
 * Requires `pnpm build:ci` (or `pnpm build`) to have run first — these suites
 * boot `next start`, deliberately, so they exercise the production runtime
 * rather than the dev server. `pnpm test:e2e` does the build for you.
 *
 * Suites run sequentially: each boots its own server on an ephemeral port, and
 * running them in parallel would make the in-process rate limiters and stores
 * interfere in ways that produce confusing, non-deterministic failures.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

if (!existsSync(path.join(root, ".next"))) {
  console.error("\x1b[31mNo production build found.\x1b[0m Run `pnpm build:ci` first, or use `pnpm test:e2e`.");
  process.exit(1);
}

const suites = [
  { name: "public journeys", file: "public-journeys.mjs" },
  { name: "auth flows", file: "auth-flows.mjs" },
];

let failed = 0;

for (const suite of suites) {
  console.log(`\n\x1b[1m\x1b[36m━━━ ${suite.name} ━━━\x1b[0m`);
  const result = spawnSync(process.execPath, [path.join(here, suite.file)], { cwd: root, stdio: "inherit" });
  if ((result.status ?? 1) !== 0) failed += 1;
}

console.log("");
if (failed > 0) {
  console.error(`\x1b[31m${failed} end-to-end suite(s) failed.\x1b[0m`);
  process.exit(1);
}
console.log("\x1b[32mAll end-to-end suites passed.\x1b[0m");
