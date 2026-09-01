#!/usr/bin/env node
/**
 * One-command local database setup for network-restricted sandboxes.
 *
 * Run:   pnpm db:setup:sandbox          (setup everything)
 *        pnpm db:setup:sandbox --stop   (stop the sandbox Postgres)
 *
 * What it does (idempotent — safe to re-run):
 *   1. Installs repo dependencies if node_modules is missing (pnpm).
 *   2. Creates .env from .env.example (Prisma data source, random
 *      encryption key, local DATABASE_URL) if .env is missing.
 *   3. Installs an embedded PostgreSQL binary (npm, into tmp/sandbox/pg —
 *      gitignored) if not already present, initializes a cluster there
 *      (trust auth, bound to 127.0.0.1 only — sandbox/dev use only) and
 *      starts it detached on port 5432.
 *   4. Creates the `architech` database if missing.
 *   5. Ensures the Prisma schema-engine: tries the CLI's own download; if
 *      that fails (blocked network), installs scripts/sandbox/
 *      schema-engine-shim.cjs in its place. Then generates the client.
 *   6. Applies all migrations. If the server lacks PostGIS (the embedded
 *      build does), the two geo-dependent migrations are temporarily
 *      stubbed (geography/geometry -> TEXT, GIST/trgm indexes skipped),
 *      applied, and the original migration files are restored byte-for-byte.
 *   7. Runs prisma/seed.mjs (idempotent upserts).
 *
 * Afterwards: `pnpm dev` serves the site with ARCHITECH_DATA_SOURCE=prisma.
 *
 * Notes:
 *   - The app's runtime code never calls PostGIS functions, so the TEXT
 *     stubs do not change application behavior.
 *   - On a machine with real internet + PostGIS (docker compose), the same
 *     migrations apply unmodified via `pnpm db:migrate`; this script's stub
 *     path is only taken when `pg_available_extensions` lacks postgis.
 *   - The sandbox cluster is disposable: deleting tmp/sandbox/pg and
 *     re-running this script rebuilds it from migrations + seed.
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
const SANDBOX_DIR = path.join(repoRoot, "tmp", "sandbox");
const PG_DIR = path.join(SANDBOX_DIR, "pg");
const PG_DATA = path.join(PG_DIR, "data");
const PG_LOG = path.join(SANDBOX_DIR, "pg.log");
const PG_PORT = Number(process.env.ARCHITECH_SANDBOX_PG_PORT ?? 5432);
const PG_USER = "architech";
const PG_PASS = "architech";
const PG_DB = "architech";
const DATABASE_URL = `postgresql://${PG_USER}:${PG_PASS}@localhost:${PG_PORT}/${PG_DB}?schema=public`;
const SHIM_SRC = path.join(
  repoRoot,
  "scripts",
  "sandbox",
  "schema-engine-shim.cjs"
);
const PRISMA_CLI = path.join(
  repoRoot,
  "node_modules",
  "prisma",
  "build",
  "index.js"
);

const log = msg => console.log(`[setup-local-db] ${msg}`);
const fail = msg => {
  console.error(`[setup-local-db] ERROR: ${msg}`);
  process.exit(1);
};

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: repoRoot, stdio: "inherit", ...opts });
  if (r.status !== 0) fail(`${cmd} ${args.join(" ")} exited with ${r.status}`);
}

function portOpen(port, host = "127.0.0.1") {
  return new Promise(resolve => {
    const socket = net.connect({ port, host, timeout: 750 });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

function pgNativeBin() {
  // The platform package is not `exports`-resolvable, so locate it by
  // scanning for whichever platform directory contains the binaries.
  const base = path.join(PG_DIR, "node_modules", "@embedded-postgres");
  if (!fs.existsSync(base))
    fail(
      "embedded-postgres not installed in tmp/sandbox/pg (run pnpm db:setup:sandbox again)"
    );
  for (const entry of fs.readdirSync(base)) {
    const binDir = path.join(base, entry, "native", "bin");
    if (fs.existsSync(path.join(binDir, "postgres"))) return binDir;
  }
  fail(
    `no embedded-postgres binaries found under ${path.relative(repoRoot, base)}`
  );
}

function connectAdmin() {
  const req = createRequire(import.meta.url);
  const pg = req("pg");
  return new pg.Client({
    host: "127.0.0.1",
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASS,
    database: "postgres",
    connectionTimeoutMillis: 5000,
  });
}

// --------------------------------------------------------------------------
// Step 1: dependencies
// --------------------------------------------------------------------------
async function ensureDependencies() {
  if (fs.existsSync(PRISMA_CLI)) {
    log("dependencies present");
    return;
  }
  log("node_modules missing — running pnpm install ...");
  const which = spawnSync("pnpm", ["--version"], { stdio: "ignore" });
  if (which.status !== 0) {
    fail(
      "pnpm is not available. Install it (e.g. `corepack enable` — the repo pins pnpm@10.4.1) and re-run."
    );
  }
  run("pnpm", ["install", "--frozen-lockfile"]);
}

// --------------------------------------------------------------------------
// Step 2: .env
// --------------------------------------------------------------------------
function ensureEnvFile() {
  const envPath = path.join(repoRoot, ".env");
  if (fs.existsSync(envPath)) {
    log(".env present (left untouched)");
    return;
  }
  const example = fs.readFileSync(path.join(repoRoot, ".env.example"), "utf8");
  const key = crypto.randomBytes(32).toString("base64");
  const lines = example
    .split("\n")
    .map(line => {
      if (line.startsWith("ARCHITECH_DATA_SOURCE="))
        return "ARCHITECH_DATA_SOURCE=prisma";
      if (line.startsWith("ARCHITECH_SEARCH_SOURCE="))
        return "ARCHITECH_SEARCH_SOURCE=prisma";
      if (line.startsWith("ARCHITECH_CONTACT_ENCRYPTION_KEY="))
        return `ARCHITECH_CONTACT_ENCRYPTION_KEY=${key}`;
      if (line.startsWith("DATABASE_URL="))
        return `DATABASE_URL=${DATABASE_URL}`;
      if (line.startsWith("NEXT_PUBLIC_SITE_URL="))
        // The sandbox is reached through an ephemeral preview-proxy origin, so
        // the fixed example URL would reject every browser mutation with
        // ORIGIN_REJECTED (request-safety.ts only enforces when set).
        return "NEXT_PUBLIC_SITE_URL= # sandbox: empty on purpose; real deployments set their public origin";
      return line;
    })
    .join("\n");
  fs.writeFileSync(envPath, lines);
  log(
    `.env created (Prisma data source, random encryption key, DATABASE_URL=${DATABASE_URL})`
  );
}

// --------------------------------------------------------------------------
// Steps 3-4: embedded PostgreSQL
// --------------------------------------------------------------------------
async function ensurePostgresBinaries() {
  if (fs.existsSync(path.join(PG_DIR, "node_modules", "@embedded-postgres"))) {
    log("embedded postgres binaries present");
    return;
  }
  log("installing embedded postgres binaries (npm) into tmp/sandbox/pg ...");
  fs.mkdirSync(PG_DIR, { recursive: true });
  const init = spawnSync("npm", ["init", "-y"], {
    cwd: PG_DIR,
    stdio: "ignore",
  });
  if (init.status !== 0) fail("npm init failed");
  const r = spawnSync(
    "npm",
    ["install", "--no-audit", "--no-fund", "embedded-postgres"],
    {
      cwd: PG_DIR,
      stdio: "inherit",
    }
  );
  if (r.status !== 0)
    fail(
      "npm install embedded-postgres failed (is the npm registry reachable?)"
    );
}

async function ensureCluster() {
  if (!fs.existsSync(path.join(PG_DATA, "PG_VERSION"))) {
    log("initializing postgres cluster ...");
    const initdb = path.join(pgNativeBin(), "initdb");
    const r = spawnSync(
      initdb,
      [
        "-D",
        PG_DATA,
        "-U",
        PG_USER,
        "-A",
        "trust",
        "--encoding=UTF8",
        "--locale=C",
      ],
      {
        stdio: "inherit",
      }
    );
    if (r.status !== 0) fail("initdb failed");
  }
}

async function startPostgresIfNeeded() {
  if (await portOpen(PG_PORT)) {
    log(
      `port ${PG_PORT} already listening — assuming the sandbox cluster is running`
    );
    return;
  }
  log(
    `starting postgres on 127.0.0.1:${PG_PORT} (detached, log: ${path.relative(repoRoot, PG_LOG)}) ...`
  );
  const postgres = path.join(pgNativeBin(), "postgres");
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });
  const out = fs.openSync(PG_LOG, "a");
  const child = spawn(
    postgres,
    [
      "-D",
      PG_DATA,
      "-p",
      String(PG_PORT),
      "-k",
      SANDBOX_DIR,
      "-c",
      `listen_addresses=127.0.0.1`,
    ],
    {
      detached: true,
      stdio: ["ignore", out, out],
    }
  );
  child.unref();
  if (!(await waitForPort(PG_PORT))) {
    fail(
      `postgres did not start on port ${PG_PORT}; check ${path.relative(repoRoot, PG_LOG)}`
    );
  }
  log(`postgres ready (pid ${child.pid})`);
}

async function ensureDatabase() {
  const admin = connectAdmin();
  try {
    await admin.connect();
    const r = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [PG_DB]
    );
    if (r.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${PG_DB}"`);
      log(`database "${PG_DB}" created`);
    } else {
      log(`database "${PG_DB}" present`);
    }
  } finally {
    await admin.end().catch(() => {});
  }
}

// --------------------------------------------------------------------------
// Step 5: prisma engine + client generation
// --------------------------------------------------------------------------
function enginesDir() {
  const req = createRequire(import.meta.url);
  const prismaPkg = req.resolve("prisma/package.json");
  const prismaReq = createRequire(
    path.join(path.dirname(prismaPkg), "noop.js")
  );
  const enginesPkg = prismaReq.resolve("@prisma/engines/package.json");
  return path.dirname(enginesPkg);
}

function runPrisma(args, timeoutMs = 240000) {
  return spawnSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    timeout: timeoutMs,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? DATABASE_URL,
    },
  });
}

function ensureEngine() {
  const dir = enginesDir();
  // The platform-specific file name the Prisma CLI expects on this machine.
  const candidates = fs
    .readdirSync(dir)
    .filter(f => f.startsWith("schema-engine-") && !f.endsWith(".sha256"))
    .map(f => path.join(dir, f));
  const usable = candidates.find(f => {
    try {
      const r = spawnSync(f, ["--version"], { stdio: "pipe", timeout: 15000 });
      return r.status === 0 && String(r.stdout).trim().length > 0;
    } catch {
      return false;
    }
  });
  if (usable) {
    log(`prisma engine available (${path.basename(usable)})`);
    runPrisma(["generate", "--schema", "prisma/schema.prisma"]);
    log("client generated");
    return;
  }
  log(
    "prisma engine binary missing — trying the CLI's own download via `prisma generate` ..."
  );
  const attempt = spawnSync(
    process.execPath,
    [PRISMA_CLI, "generate", "--schema", "prisma/schema.prisma"],
    {
      cwd: repoRoot,
      stdio: "inherit",
      timeout: 180000,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL ?? DATABASE_URL,
      },
    }
  );
  if (attempt.status === 0) {
    log("prisma engine downloaded and client generated");
    return;
  }
  log(
    "engine download failed (network-restricted) — installing sandbox schema-engine shim ..."
  );
  const target =
    candidates[0] ?? path.join(dir, "schema-engine-debian-openssl-3.0.x");
  fs.copyFileSync(SHIM_SRC, target);
  fs.chmodSync(target, 0o755);
  log(`shim installed at ${path.relative(repoRoot, target)}`);
  // Hard-fail if the engine (real or shim) does not actually execute — the
  // Prisma CLI can otherwise exit 0 on `migrate deploy` without applying
  // anything (its download step is fail-silent when a binary file exists).
  const check = spawnSync(target, ["--version"], {
    stdio: "pipe",
    timeout: 15000,
  });
  if (check.status !== 0 || !String(check.stdout).trim()) {
    fail(
      `engine binary at ${path.relative(repoRoot, target)} does not run: ${check.stderr}`
    );
  }
  runPrisma(["generate", "--schema", "prisma/schema.prisma"]);
  log("client generated (via shim)");
}

// --------------------------------------------------------------------------
// Step 6: migrations (with PostGIS-absence fallback)
// --------------------------------------------------------------------------
function patchLocationSql(sql) {
  let s = sql;
  s = s.replace(
    'CREATE EXTENSION IF NOT EXISTS "postgis";',
    "-- SANDBOX-ONLY: postgis extension not available in this server; geo columns stubbed as TEXT\n-- (applied by scripts/sandbox/setup-local-db.mjs; original file restored afterwards)"
  );
  s = s.replace(/"centroid" geography\(Point,4326\),/g, '"centroid" TEXT,');
  s = s.replace(
    /"boundary" geometry\(MultiPolygon,4326\),/g,
    '"boundary" TEXT,'
  );
  s = s.replace(
    /SET "centroid" = ST_SetSRID\(ST_MakePoint\("longitude"::double precision, "latitude"::double precision\), 4326\)::geography/,
    "SET \"centroid\" = 'POINT(' || \"longitude\"::text || ' ' || \"latitude\"::text || ')'"
  );
  for (const idx of [
    "AdministrativeArea_boundary_gist",
    "Locality_centroid_gist",
    "Locality_boundary_gist",
  ]) {
    const line = s.split("\n").find(l => l.includes(`"${idx}"`));
    if (line) s = s.replace(line, `-- SANDBOX-ONLY: ${line}`);
  }
  return s;
}

function patchSearchIndexSql(sql) {
  let s = sql;
  s = s.replace(
    "CREATE EXTENSION IF NOT EXISTS pg_trgm;",
    "-- SANDBOX-ONLY: pg_trgm extension not available in this server; trgm indexes skipped\n-- (applied by scripts/sandbox/setup-local-db.mjs; original file restored afterwards)"
  );
  for (const name of [
    "Listing_title_trgm_idx",
    "Listing_description_trgm_idx",
    "Listing_addressLocality_trgm_idx",
    "Locality_name_trgm_idx",
  ]) {
    const re = new RegExp(
      `CREATE INDEX IF NOT EXISTS "${name}"\\s+ON [^;]+;`,
      "s"
    );
    s = s.replace(re, m =>
      m
        .split("\n")
        .map(l => `-- SANDBOX-ONLY: ${l}`)
        .join("\n")
    );
  }
  return s;
}

async function hasPostGis() {
  const { Client } = createRequire(import.meta.url)("pg");
  const c = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    await c.connect();
    const r = await c.query(
      "SELECT 1 FROM pg_available_extensions WHERE name = 'postgis'"
    );
    return r.rowCount > 0;
  } finally {
    await c.end().catch(() => {});
  }
}

async function verifyMigrationsApplied() {
  // The Prisma CLI can exit 0 even when the engine is unusable, so assert
  // that the migration history was actually written.
  const { Client } = createRequire(import.meta.url)("pg");
  const c = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    await c.connect();
    const r = await c.query("SELECT count(*)::int FROM _prisma_migrations");
    const applied = r.rows[0].count;
    const expected = fs.readdirSync(
      path.join(repoRoot, "prisma", "migrations")
    ).length;
    if (applied !== expected) {
      fail(
        `migration verification failed: ${applied}/${expected} migrations recorded in _prisma_migrations`
      );
    }
    log(`migrations verified: ${applied}/${expected} recorded`);
  } catch (e) {
    fail(`migration verification failed: ${e.message}`);
  } finally {
    await c.end().catch(() => {});
  }
}

async function applyMigrations(postgisAvailable) {
  if (postgisAvailable) {
    log("applying migrations (unmodified) ...");
    runPrisma(["migrate", "deploy"]);
  } else {
    log(
      "postgis unavailable — applying migrations with temporary geo stubs ..."
    );
    const targets = [
      {
        file: "prisma/migrations/202608300002_india_location_foundation/migration.sql",
        patch: patchLocationSql,
      },
      {
        file: "prisma/migrations/202608240002_search_indexes/migration.sql",
        patch: patchSearchIndexSql,
      },
    ];
    const originals = targets.map(t => ({
      ...t,
      original: fs.readFileSync(t.file, "utf8"),
    }));
    try {
      for (const t of originals) fs.writeFileSync(t.file, t.patch(t.original));
      runPrisma(["migrate", "deploy"]);
    } finally {
      for (const t of originals) {
        const current = fs.readFileSync(t.file, "utf8");
        if (current !== t.original) fs.writeFileSync(t.file, t.original);
      }
    }
    log("original migration files restored");
  }
  await verifyMigrationsApplied();
}

// --------------------------------------------------------------------------
// Step 7: seed
// --------------------------------------------------------------------------
function seedDatabase() {
  log("seeding ...");
  const r = spawnSync(
    process.execPath,
    [path.join(repoRoot, "prisma", "seed.mjs")],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL },
    }
  );
  if (r.status !== 0) fail("seed failed");
}

// --------------------------------------------------------------------------
// Stop
// --------------------------------------------------------------------------
function stopPostgres() {
  const pgCtl = path.join(pgNativeBin(), "pg_ctl");
  const r = spawnSync(pgCtl, ["-D", PG_DATA, "stop", "-m", "fast"], {
    stdio: "inherit",
  });
  log(
    r.status === 0
      ? "sandbox postgres stopped"
      : "pg_ctl stop reported a problem (check pg.log)"
  );
}

// --------------------------------------------------------------------------
async function main() {
  if (process.argv.includes("--stop")) {
    if (!fs.existsSync(path.join(PG_DATA, "PG_VERSION")))
      fail("no sandbox cluster found at tmp/sandbox/pg/data");
    stopPostgres();
    return;
  }

  console.log("Architech sandbox database setup");
  console.log(`  repo:    ${repoRoot}`);
  console.log(
    `  postgres: 127.0.0.1:${PG_PORT} db="${PG_DB}" (cluster: tmp/sandbox/pg/data)`
  );
  console.log("");

  await ensureDependencies();
  ensureEnvFile();
  await ensurePostgresBinaries();
  await ensureCluster();
  await startPostgresIfNeeded();
  await ensureDatabase();
  ensureEngine();
  await applyMigrations(await hasPostGis());
  seedDatabase();

  console.log("");
  console.log("Done. The database is live:");
  console.log(`  ${DATABASE_URL}`);
  console.log("Start the site with:");
  console.log("  pnpm dev");
  console.log("Stop the sandbox postgres with:");
  console.log("  pnpm db:setup:sandbox --stop");
}

main().catch(e => fail(e.stack || e.message));
