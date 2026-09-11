#!/usr/bin/env node
/* Run the PWA installability audit against the REAL production artifact.

   CI calls `pnpm build` (next build + materialize-static-publish) and then this
   script. It boots the static publisher (`dist/index.js`) on an ephemeral port
   and points pwa-audit.mjs at it, so the gate exercises the same bytes that
   ship — including the publisher's own Cache-Control and MIME rules. Booting
   `next start` instead would miss those (the Next server has its own, checked
   separately in dev).

   Exit code propagates from the audit, so a regression is a red build. */

import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const entry = path.join(root, "dist", "index.js");
const audit = path.join(root, "ops", "scripts", "audit", "pwa-audit.mjs");

if (!existsSync(entry)) {
  console.error("[run-pwa-audit] dist/index.js missing — run `pnpm build` first.");
  process.exit(1);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      /* not up yet */
    }
    if (child.exitCode !== null) {
      console.error(`[run-pwa-audit] publisher exited with ${child.exitCode}`);
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  console.error(`[run-pwa-audit] publisher at ${baseUrl} not ready in ${timeoutMs}ms`);
  process.exit(1);
}

const port = await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;

const child = spawn(process.execPath, [entry], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "ignore", "inherit"],
});

let exitCode = 1;
try {
  await waitForServer(baseUrl, child);
  const result = spawnSync(process.execPath, [audit, baseUrl], { stdio: "inherit" });
  exitCode = result.status ?? 1;
} finally {
  child.kill();
}

process.exit(exitCode);
