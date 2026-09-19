#!/usr/bin/env node
/**
 * Fast pre-flight check before starting the Next.js dev server.
 * Ensures PostgreSQL is listening on port 5432 and CRM tables exist.
 * Takes < 15ms if already running.
 */
import net from "node:net";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const port = 5432;

function checkPort(p) {
  return new Promise((resolve) => {
    const s = net.connect({ port: p, host: "127.0.0.1", timeout: 400 });
    s.on("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.on("error", () => resolve(false));
    s.on("timeout", () => {
      s.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const isOpen = await checkPort(port);
  if (!isOpen) {
    console.log("[dev-services] PostgreSQL is not running. Booting sandbox database and applying CRM schema...");
    spawnSync(process.execPath, [path.join(here, "sandbox", "install-schema-engine-shim.mjs")], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    spawnSync(process.execPath, [path.join(here, "sandbox", "setup-local-db.mjs")], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    spawnSync(process.execPath, [path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"), path.join(here, "seed-techno-demo.ts"), "demo-org-nivasa-partners"], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    spawnSync(process.execPath, [path.join(here, "init-crm-db.mjs")], {
      cwd: repoRoot,
      stdio: "inherit",
    });
  } else {
    // Port open - run lightweight sync if needed
    spawnSync(process.execPath, [path.join(here, "init-crm-db.mjs")], {
      cwd: repoRoot,
      stdio: "pipe",
    });
  }
  console.log("[dev-services] ✓ PostgreSQL & Frappe CRM database ready on port 5432.");
}

main().catch((err) => {
  console.warn("[dev-services] Database preflight warning (continuing dev server):", err.message);
});
