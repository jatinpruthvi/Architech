import assert from "node:assert/strict";
import test from "node:test";
import { pollOnce, runWorker } from "./outbox-worker.mjs";

test("polls the private relative worker route without using browser/provider URLs", async () => {
  const calls = [];
  const status = await pollOnce({
    targetUrl: "https://architech.internal/",
    secret: "server-secret",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200 };
    },
  });
  assert.equal(status, 200);
  assert.equal(calls[0].url, "https://architech.internal/api/internal/scheduled/whatsapp");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["x-architech-worker-secret"], "server-secret");
  assert.equal(Object.keys(calls[0].options.headers).includes("authorization"), false);
});

test("--once-style polling surfaces 401 and network errors without reading response bodies", async () => {
  await assert.rejects(
    runWorker({ once: true, env: { WHATSAPP_WORKER_TARGET_URL: "https://architech.internal", ARCHITECH_WHATSAPP_WORKER_SECRET: "secret" }, fetchImpl: async () => ({ ok: false, status: 401, json: async () => { throw new Error("must not read"); } }) }),
    /HTTP 401/,
  );
  await assert.rejects(
    runWorker({ once: true, env: { WHATSAPP_WORKER_TARGET_URL: "https://architech.internal", ARCHITECH_WHATSAPP_WORKER_SECRET: "secret" }, fetchImpl: async () => { throw new Error("network down"); } }),
    /network down/,
  );
});

test("retry sleep uses bounded exponential backoff", async () => {
  const delays = [];
  const controller = new AbortController();
  let calls = 0;
  await runWorker({
    env: { WHATSAPP_WORKER_TARGET_URL: "https://architech.internal", ARCHITECH_WHATSAPP_WORKER_SECRET: "secret" },
    intervalMs: 10,
    maxBackoffMs: 30,
    fetchImpl: async () => {
      calls += 1;
      throw new Error("temporary");
    },
    sleep: async (delay) => {
      delays.push(delay);
      if (delays.length === 3) controller.abort();
    },
    signal: controller.signal,
  });
  assert.deepEqual(delays, [10, 20, 30]);
});
