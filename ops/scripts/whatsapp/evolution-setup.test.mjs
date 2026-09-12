import assert from "node:assert/strict";
import test from "node:test";
import { baseEnvText, composeArgs, fingerprint, generateSecret, mergeEnv, preflight, readEnvValue, verifyApiKey, waitForEvolution } from "./evolution-setup.mjs";

test("generated secrets are 32 bytes of hex and never repeat", () => {
  const first = generateSecret();
  const second = generateSecret();
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, second);
  assert.match(generateSecret(16), /^[0-9a-f]{32}$/);
});

test("fingerprint is stable and does not reveal the value", () => {
  assert.equal(fingerprint("hunter2"), fingerprint("hunter2"));
  assert.notEqual(fingerprint("hunter2"), fingerprint("hunter3"));
  assert.equal(fingerprint("hunter2").length, 12);
  assert.equal(fingerprint("hunter2").includes("hunter2"), false);
});

test("mergeEnv fills empty slots and leaves operator-set values alone", () => {
  const current = ["# WhatsApp block", "ARCHITECH_EVOLUTION_API_URL=", "ARCHITECH_EVOLUTION_API_KEY=already-chosen", "ARCHITECH_IDEMPOTENCY_HMAC_KEY="].join("\n");
  const result = mergeEnv(current, { secrets: { ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY: "jwt-secret" } });

  // Comments and existing values survive untouched.
  assert.equal(result.text.includes("# WhatsApp block"), true);
  assert.equal(readEnvValue(result.text, "ARCHITECH_EVOLUTION_API_KEY"), "already-chosen");
  assert.deepEqual(result.preserved, ["ARCHITECH_EVOLUTION_API_KEY"]);

  // Empty slots get a value; absent keys are appended.
  assert.equal(readEnvValue(result.text, "ARCHITECH_EVOLUTION_API_URL"), "http://127.0.0.1:8080");
  assert.equal(readEnvValue(result.text, "ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY"), "jwt-secret");
  assert.equal(readEnvValue(result.text, "ARCHITECH_WHATSAPP_WORKER_SECRET").length, 64);

  // Every managed key is present exactly once after the merge.
  for (const name of ["ARCHITECH_EVOLUTION_API_URL", "ARCHITECH_EVOLUTION_API_KEY", "ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY", "ARCHITECH_EVOLUTION_WEBHOOK_URL", "ARCHITECH_WHATSAPP_WORKER_SECRET", "ARCHITECH_IDEMPOTENCY_HMAC_KEY", "WHATSAPP_WORKER_TARGET_URL"]) {
    const occurrences = result.text.split("\n").filter((line) => line.startsWith(`${name}=`));
    assert.equal(occurrences.length, 1, `${name} should appear once, got ${occurrences.length}`);
  }
});

test("mergeEnv is idempotent: a second pass changes nothing", () => {
  const first = mergeEnv("", {});
  const second = mergeEnv(first.text, {});
  assert.equal(second.text, first.text);
  assert.deepEqual(second.generated, []);
  assert.equal(second.preserved.length, 7);
});

test("mergeEnv leaves the gated feature flags off unless explicitly enabled", () => {
  const off = mergeEnv("ARCHITECH_WHATSAPP_ENABLED=false\n", {});
  assert.equal(readEnvValue(off.text, "ARCHITECH_WHATSAPP_ENABLED"), "false");

  const on = mergeEnv("ARCHITECH_WHATSAPP_ENABLED=false\n", { enableFlags: true });
  assert.equal(readEnvValue(on.text, "ARCHITECH_WHATSAPP_ENABLED"), "true");
  assert.equal(readEnvValue(on.text, "ARCHITECH_WHATSAPP_REAL_NUMBERS_ENABLED"), "true");
});

test("baseEnvText seeds from .env.example on a fresh clone instead of writing a stub", () => {
  const example = ["# example", "DATABASE_URL=postgresql://x", "ARCHITECH_WHATSAPP_ENABLED=false", "ARCHITECH_EVOLUTION_API_KEY="].join("\n");

  const fresh = baseEnvText({ existing: "", example });
  assert.equal(fresh.seeded, true);
  assert.equal(fresh.text.includes("DATABASE_URL=postgresql://x"), true);
  assert.equal(readEnvValue(fresh.text, "ARCHITECH_WHATSAPP_ENABLED"), "false");

  // The merged result must keep the whole example, not just the managed keys.
  const merged = mergeEnv(fresh.text, {});
  assert.equal(readEnvValue(merged.text, "DATABASE_URL"), "postgresql://x");
  assert.equal(readEnvValue(merged.text, "ARCHITECH_WHATSAPP_ENABLED"), "false");
  assert.equal(readEnvValue(merged.text, "ARCHITECH_EVOLUTION_API_KEY").length, 64);
  assert.equal(merged.text.includes("# example"), true);

  // An existing .env is used as-is and never re-seeded.
  const present = baseEnvText({ existing: "DATABASE_URL=postgresql://mine", example });
  assert.equal(present.seeded, false);
  assert.equal(present.text, "DATABASE_URL=postgresql://mine");
});

test("composeArgs targets the pinned compose file", () => {
  assert.deepEqual(composeArgs("up", { extra: ["-d", "--wait"] }), ["compose", "-f", "docker-compose.whatsapp.yml", "up", "-d", "--wait"]);
  assert.deepEqual(composeArgs("down", { extra: ["-v"] }), ["compose", "-f", "docker-compose.whatsapp.yml", "down", "-v"]);
});

test("preflight names every missing prerequisite without touching docker", () => {
  const calls = [];
  const issues = preflight({
    cwd: "/nonexistent-repo-root",
    run: (command, args) => {
      calls.push([command, ...args].join(" "));
      return { status: 1 };
    },
  });
  assert.equal(issues.length, 4);
  assert.match(issues[0], /docker CLI not found/);
  assert.match(issues[1], /compose/);
  assert.match(issues[2], /docker-compose\.whatsapp\.yml not found/);
  assert.match(issues[3], /daemon unreachable/);
  assert.deepEqual(calls, ["docker --version", "docker compose -f docker-compose.whatsapp.yml version", "docker info"]);
});

test("preflight passes when docker, compose, and the compose file are present", () => {
  const issues = preflight({
    cwd: process.cwd(),
    run: () => ({ status: 0 }),
  });
  assert.deepEqual(issues, []);
});

test("waitForEvolution keeps polling while the container boots, then reports the version", async () => {
  const seen = [];
  let attempts = 0;
  const health = await waitForEvolution({
    baseUrl: "http://127.0.0.1:8080",
    pollMs: 1,
    timeoutMs: 5_000,
    sleep: async () => {},
    fetchImpl: async (url) => {
      seen.push(url);
      attempts += 1;
      if (attempts < 3) throw new Error("ECONNREFUSED");
      return { status: 200, json: async () => ({ status: 200, message: "Welcome to the Evolution API, it is working!", version: "2.3.7" }) };
    },
  });
  assert.deepEqual(health, { ok: true, status: 200, version: "2.3.7" });
  assert.equal(attempts, 3);
  assert.equal(seen[0], "http://127.0.0.1:8080/");
});

test("waitForEvolution reports failure instead of hanging when the deadline passes", async () => {
  const clock = { t: 0 };
  const health = await waitForEvolution({
    baseUrl: "http://127.0.0.1:8080",
    pollMs: 1,
    timeoutMs: 10,
    now: () => clock.t,
    sleep: async () => {
      clock.t += 5;
    },
    fetchImpl: async () => ({ status: 503, json: async () => ({}) }),
  });
  assert.deepEqual(health, { ok: false, status: 503, version: "unknown" });
});

test("verifyApiKey distinguishes a key mismatch from a provider outage", async () => {
  const urlFor = [];
  const probe = async (status) =>
    verifyApiKey({
      baseUrl: "http://127.0.0.1:8080",
      apiKey: "secret",
      fetchImpl: async (url, options) => {
        urlFor.push({ url, apikey: options.headers.apikey });
        return { ok: status < 400, status };
      },
    });

  assert.deepEqual(await probe(200), { ok: true, reason: "OK" });
  assert.deepEqual(await probe(401), { ok: false, reason: "KEY_MISMATCH" });
  assert.deepEqual(await probe(403), { ok: false, reason: "KEY_MISMATCH" });
  assert.deepEqual(await probe(503), { ok: false, reason: "PROVIDER_UNAVAILABLE" });
  assert.deepEqual(await verifyApiKey({ apiKey: "" }), { ok: false, reason: "NO_KEY" });

  assert.equal(urlFor[0].url, "http://127.0.0.1:8080/instance/fetchInstances");
  assert.equal(urlFor[0].apikey, "secret");
});

test("verifyApiKey survives a network failure without leaking the URL", async () => {
  const result = await verifyApiKey({
    baseUrl: "http://127.0.0.1:8080",
    apiKey: "secret",
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED http://127.0.0.1:8080/instance/fetchInstances");
    },
  });
  assert.deepEqual(result, { ok: false, reason: "NETWORK" });
});
