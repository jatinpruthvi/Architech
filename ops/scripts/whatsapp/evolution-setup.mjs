#!/usr/bin/env node
/**
 * One-command local bootstrap for the pinned Evolution API stack that backs the
 * broker WhatsApp lead acknowledgement (see docs/broker-suite/evolution-api-setup.md).
 *
 * What it does, in order:
 *   1. Preflight: docker CLI + compose plugin + the pinned compose file.
 *   2. Secrets: fills the empty WhatsApp/Evolution values in `.env` with fresh
 *      random values. Existing non-empty values are never overwritten.
 *   3. Stack: `docker compose up -d --wait` against docker-compose.whatsapp.yml.
 *   4. Proof: hits Evolution's documented root health route, then an
 *      authenticated route to prove the app-side key and the container-side key
 *      are the same value.
 *
 * Secrets are written to `.env` on purpose: Docker Compose interpolates
 * `${ARCHITECH_EVOLUTION_API_KEY}` from that file, so the container's
 * AUTHENTICATION_API_KEY and the app's ARCHITECH_EVOLUTION_API_KEY cannot drift.
 *
 * Stdlib-only, per ops/scripts/AGENTS.md. Secret values are never printed; only
 * a SHA-256 fingerprint is shown so two environments can be compared.
 *
 * Usage:
 *   pnpm whatsapp:setup                  # preflight + secrets + up + verify
 *   pnpm whatsapp:setup -- --check       # preflight only, no writes, no docker
 *   pnpm whatsapp:setup -- --secrets     # write secrets, do not touch docker
 *   pnpm whatsapp:setup -- --down        # stop the stack, keep volumes
 *   pnpm whatsapp:setup -- --reset --yes # stop and delete Evolution volumes
 *   pnpm whatsapp:setup -- --enable-flags # also turn the two WhatsApp flags on
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const COMPOSE_FILE = "docker-compose.whatsapp.yml";
const ENV_FILE = ".env";
const LOCAL_API_URL = "http://127.0.0.1:8080";
const LOCAL_WEBHOOK_URL = "http://host.docker.internal:3000/api/internal/providers/evolution/webhook";
const LOCAL_WORKER_TARGET = "http://127.0.0.1:3000";
const HEALTH_PATH = "/";
const AUTH_PROBE_PATH = "/instance/fetchInstances";
const WAIT_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 2_000;

/** Keys the script will fill in when they are empty. Secrets get random values. */
const MANAGED_KEYS = [
  { name: "ARCHITECH_EVOLUTION_API_URL", fallback: LOCAL_API_URL },
  { name: "ARCHITECH_EVOLUTION_API_KEY", secret: true },
  { name: "ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY", secret: true },
  { name: "ARCHITECH_EVOLUTION_WEBHOOK_URL", fallback: LOCAL_WEBHOOK_URL },
  { name: "ARCHITECH_WHATSAPP_WORKER_SECRET", secret: true },
  { name: "ARCHITECH_IDEMPOTENCY_HMAC_KEY", secret: true },
  { name: "WHATSAPP_WORKER_TARGET_URL", fallback: LOCAL_WORKER_TARGET },
];

/**
 * Gated feature flags. Left exactly as found unless `--enable-flags` is passed,
 * because enabling them is an operational decision, not a setup side effect.
 */
const FLAG_KEYS = ["ARCHITECH_WHATSAPP_ENABLED", "ARCHITECH_WHATSAPP_REAL_NUMBERS_ENABLED"];

const ENV_LINE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

/** 32 random bytes as hex: safe for an HTTP header and for compose interpolation. */
export function generateSecret(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

/** Non-reversible fingerprint so an operator can compare two setups safely. */
export function fingerprint(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

/**
 * Merge managed values into existing `.env` text.
 *
 * Preserves comments, ordering, and every non-empty value that is already
 * there. Returns what changed so the caller can report it without echoing
 * secret material.
 */
export function mergeEnv(text, { secrets = {}, fallbacks = {}, enableFlags = false } = {}) {
  const lines = String(text ?? "").split("\n");
  const seen = new Set();
  const generated = [];
  const preserved = [];
  const filled = [];

  const resolve = (name, spec) => {
    if (spec.secret) {
      const value = secrets[name] ?? generateSecret();
      generated.push(name);
      return value;
    }
    filled.push(name);
    return spec.fallback ?? "";
  };

  const out = lines.map((line) => {
    const match = ENV_LINE.exec(line);
    if (!match) return line;
    const name = match[1];
    seen.add(name);
    const current = match[2];

    if (enableFlags && FLAG_KEYS.includes(name)) {
      if (current.trim() === "true") preserved.push(name);
      else filled.push(name);
      return `${name}=true`;
    }

    const spec = MANAGED_KEYS.find((entry) => entry.name === name);
    if (!spec) return line;
    // A value an operator already chose wins. Rotating is an explicit act.
    if (current.trim() !== "") {
      preserved.push(name);
      return line;
    }
    return `${name}=${resolve(name, spec)}`;
  });

  for (const spec of MANAGED_KEYS) {
    if (seen.has(spec.name)) continue;
    out.push(`${spec.name}=${resolve(spec.name, spec)}`);
  }
  if (enableFlags) {
    for (const name of FLAG_KEYS) {
      if (seen.has(name)) continue;
      out.push(`${name}=true`);
    }
  }

  const merged = out.join("\n");
  return {
    text: merged.endsWith("\n") || merged === "" ? merged : `${merged}\n`,
    generated,
    preserved,
    filled,
  };
}

/** Read a single value out of env-file text without parsing the whole file twice. */
export function readEnvValue(text, name) {
  for (const line of String(text ?? "").split("\n")) {
    const match = ENV_LINE.exec(line);
    if (match && match[1] === name) return match[2];
  }
  return undefined;
}

/**
 * Decide what to merge into.
 *
 * On a fresh clone there is no `.env`, so merging into an empty string would
 * produce a 7-line stub that looks complete but is missing DATABASE_URL,
 * ARCHITECH_DATA_SOURCE, and the feature flags. Seed from `.env.example`
 * instead, matching ops/scripts/sandbox/setup-local-db.mjs.
 */
export function baseEnvText({ existing = "", example = "" } = {}) {
  if (String(existing).trim() !== "") return { text: String(existing), seeded: false };
  return { text: String(example), seeded: String(example).trim() !== "" };
}

/** argv for the pinned compose file, with the compose subcommand last. */
export function composeArgs(subcommand, { composeFile = COMPOSE_FILE, extra = [] } = {}) {
  return ["compose", "-f", composeFile, subcommand, ...extra];
}

/** Preflight that performs no writes and starts no container. */
export function preflight({ run = spawnSync, composeFile = COMPOSE_FILE, cwd = process.cwd() } = {}) {
  const issues = [];

  const docker = run("docker", ["--version"], { cwd, stdio: "ignore" });
  if (docker.status !== 0) issues.push("docker CLI not found — install Docker Engine or Docker Desktop.");

  const compose = run("docker", composeArgs("version"), { cwd, stdio: "ignore" });
  if (compose.status !== 0) issues.push("`docker compose` (v2 plugin) not available — upgrade Docker or enable the compose plugin.");

  if (!fs.existsSync(path.join(cwd, composeFile))) {
    issues.push(`${composeFile} not found — run this script from the repository root.`);
  }

  const daemon = run("docker", ["info"], { cwd, stdio: "ignore" });
  if (daemon.status !== 0) issues.push("docker daemon unreachable — start Docker and retry.");

  return issues;
}

/**
 * Poll Evolution's root route until it answers 200.
 *
 * `GET /` is Evolution's documented health endpoint and needs no apikey, so it
 * separates "container still booting" from "key mismatch".
 */
export async function waitForEvolution({
  baseUrl = LOCAL_API_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = WAIT_TIMEOUT_MS,
  pollMs = POLL_INTERVAL_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
} = {}) {
  const deadline = now() + timeoutMs;
  let lastStatus = 0;
  while (now() < deadline) {
    try {
      const response = await fetchImpl(new URL(HEALTH_PATH, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString(), {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(Math.max(1_000, pollMs)),
      });
      lastStatus = response.status;
      if (response.status === 200) {
        let version = "unknown";
        try {
          const body = await response.json();
          if (body && typeof body === "object" && typeof body.version === "string") version = body.version;
        } catch {
          // Body shape is informational only; a 200 already proves liveness.
        }
        return { ok: true, status: 200, version };
      }
    } catch {
      // Connection refused while the container boots is expected, not an error.
    }
    await sleep(pollMs);
  }
  return { ok: false, status: lastStatus, version: "unknown" };
}

/**
 * Prove the app-side key matches the container-side key.
 *
 * Both read from `.env`, so a mismatch means the stack was started with a stale
 * shell environment. Reporting it here beats debugging a 401 from the dashboard.
 */
export async function verifyApiKey({ baseUrl = LOCAL_API_URL, apiKey, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) return { ok: false, reason: "NO_KEY" };
  let response;
  try {
    response = await fetchImpl(new URL(AUTH_PROBE_PATH, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString(), {
      headers: { apikey: apiKey, accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Do not surface the error object: it can carry the URL.
    return { ok: false, reason: "NETWORK" };
  }
  if (response.status === 401 || response.status === 403) return { ok: false, reason: "KEY_MISMATCH" };
  if (response.status >= 500) return { ok: false, reason: "PROVIDER_UNAVAILABLE" };
  return { ok: response.ok, reason: response.ok ? "OK" : `HTTP_${response.status}` };
}

/** Never echo secret material; report shape and fingerprint instead. */
function describeSecret(value) {
  return value ? `${String(value).length} chars, sha256:${fingerprint(value)}` : "unset";
}

function runDocker(args, { cwd } = {}) {
  const result = spawnSync("docker", args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function setup({ argv = process.argv.slice(2), cwd = process.cwd(), fetchImpl = globalThis.fetch, sleep } = {}) {
  const has = (flag) => argv.includes(flag);
  const composeFile = COMPOSE_FILE;

  if (has("--check")) {
    const issues = preflight({ cwd });
    if (issues.length) {
      process.stderr.write(`Preflight failed:\n${issues.map((issue) => `  ✗ ${issue}`).join("\n")}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`Preflight passed: docker, compose plugin, and ${composeFile} are available.\n`);
    return;
  }

  if (has("--reset")) {
    if (!has("--yes")) {
      process.stderr.write("Refusing --reset without --yes: it deletes the Evolution data volumes.\n");
      process.exitCode = 1;
      return;
    }
    const issues = preflight({ cwd });
    if (issues.length) throw new Error(issues[0]);
    process.exitCode = runDocker(composeArgs("down", { composeFile, extra: ["-v"] }), { cwd }) === 0 ? 0 : 1;
    return;
  }

  if (has("--down")) {
    const issues = preflight({ cwd });
    if (issues.length) throw new Error(issues[0]);
    process.exitCode = runDocker(composeArgs("down", { composeFile }), { cwd }) === 0 ? 0 : 1;
    return;
  }

  const envPath = path.join(cwd, ENV_FILE);
  const examplePath = path.join(cwd, ".env.example");
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  if (!existing.trim() && !fs.existsSync(examplePath)) {
    throw new Error(`Neither ${ENV_FILE} nor .env.example found — run this script from the repository root.`);
  }
  const base = baseEnvText({ existing, example: fs.existsSync(examplePath) ? fs.readFileSync(examplePath, "utf8") : "" });
  const merged = mergeEnv(base.text, { enableFlags: has("--enable-flags") });

  if (base.seeded) process.stdout.write(`Seeded ${ENV_FILE} from .env.example.\n`);

  // Write when something actually changed, or when the operator asked for a
  // secrets-only pass and the file is missing entirely.
  const written = merged.text !== existing;
  if (written || (has("--secrets") && !fs.existsSync(envPath))) {
    fs.writeFileSync(envPath, merged.text, { mode: 0o600 });
    try {
      fs.chmodSync(envPath, 0o600);
    } catch {
      // chmod is best-effort on platforms without POSIX modes.
    }
  }

  process.stdout.write(`Secrets in ${ENV_FILE}:\n`);
  for (const spec of MANAGED_KEYS) {
    const value = readEnvValue(merged.text, spec.name) ?? "";
    if (spec.secret) process.stdout.write(`  ${spec.name}: ${describeSecret(value)}\n`);
    else process.stdout.write(`  ${spec.name}=${value}\n`);
  }
  if (merged.generated.length) process.stdout.write(`  generated: ${merged.generated.join(", ")}\n`);
  if (merged.preserved.length) process.stdout.write(`  preserved (already set): ${merged.preserved.join(", ")}\n`);

  for (const name of FLAG_KEYS) {
    const value = readEnvValue(merged.text, name) ?? "";
    if (value.trim() !== "true") {
      process.stdout.write(`  note: ${name} is "${value || "unset"}" — pass --enable-flags for the synthetic pilot.\n`);
    }
  }

  if (has("--secrets")) {
    process.stdout.write(`\nWrote ${ENV_FILE} only. Run without --secrets to start the stack.\n`);
    return;
  }

  const issues = preflight({ cwd });
  if (issues.length) {
    process.stderr.write(`\nPreflight failed:\n${issues.map((issue) => `  ✗ ${issue}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`\nStarting ${composeFile} (this waits for healthchecks)...\n`);
  const upStatus = runDocker(composeArgs("up", { composeFile, extra: ["-d", "--wait"] }), { cwd });
  if (upStatus !== 0) {
    process.stderr.write("docker compose up failed. See the output above.\n");
    process.exitCode = 1;
    return;
  }

  const baseUrl = (readEnvValue(merged.text, "ARCHITECH_EVOLUTION_API_URL") || LOCAL_API_URL).trim();
  process.stdout.write(`Waiting for Evolution at ${baseUrl} ...\n`);
  const health = await waitForEvolution({ baseUrl, fetchImpl, ...(sleep ? { sleep } : {}) });
  if (!health.ok) {
    process.stderr.write(`Evolution did not become healthy (last status ${health.status}).\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Evolution is up (version ${health.version}).\n`);

  const apiKey = readEnvValue(merged.text, "ARCHITECH_EVOLUTION_API_KEY") ?? "";
  const auth = await verifyApiKey({ baseUrl, apiKey, fetchImpl });
  if (!auth.ok) {
    process.stderr.write(`Key check failed (${auth.reason}). Restart the stack so it picks up ${ENV_FILE}.\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Key check passed (sha256:${fingerprint(apiKey)} matches the container).\n`);

  process.stdout.write(
    [
      "",
      "Next steps:",
      "  1. pnpm db:migrate",
      "  2. pnpm dev",
      "  3. Open the broker dashboard WhatsApp panel and scan the QR with a company test number.",
      "  4. pnpm whatsapp:worker -- --once",
      "",
      "Full guide: docs/broker-suite/evolution-api-setup.md",
      "",
    ].join("\n"),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setup().catch((error) => {
    // Exclude the error object: it can contain a URL or provider response.
    process.stderr.write(`${error instanceof Error ? error.message : "evolution setup failed"}\n`);
    process.exitCode = 1;
  });
}
