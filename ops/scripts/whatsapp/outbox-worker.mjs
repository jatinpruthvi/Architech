#!/usr/bin/env node

const DEFAULT_INTERVAL_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const WORKER_PATH = "/api/internal/scheduled/whatsapp";

function requireConfig(env = process.env) {
  const targetUrl = typeof env.WHATSAPP_WORKER_TARGET_URL === "string" ? env.WHATSAPP_WORKER_TARGET_URL.trim() : "";
  const secret = typeof env.ARCHITECH_WHATSAPP_WORKER_SECRET === "string" ? env.ARCHITECH_WHATSAPP_WORKER_SECRET : "";
  if (!targetUrl) throw new Error("WHATSAPP_WORKER_TARGET_URL is required");
  if (!secret) throw new Error("ARCHITECH_WHATSAPP_WORKER_SECRET is required");
  let url;
  try {
    url = new URL(WORKER_PATH, targetUrl.endsWith("/") ? targetUrl : `${targetUrl}/`);
  } catch {
    throw new Error("WHATSAPP_WORKER_TARGET_URL must be an absolute URL");
  }
  return { url: url.toString(), secret };
}

export async function pollOnce({ targetUrl, secret, fetchImpl = globalThis.fetch, env = process.env } = {}) {
  const config = targetUrl && secret ? { url: new URL(WORKER_PATH, targetUrl.endsWith("/") ? targetUrl : `${targetUrl}/`).toString(), secret } : requireConfig(env);
  const response = await fetchImpl(config.url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "x-architech-worker-secret": config.secret,
    },
  });
  if (!response.ok) throw new Error(`worker returned HTTP ${response.status}`);
  return response.status;
}

function wait(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export async function runWorker({ once = false, intervalMs = DEFAULT_INTERVAL_MS, maxBackoffMs = MAX_BACKOFF_MS, fetchImpl = globalThis.fetch, sleep = wait, env = process.env, signal } = {}) {
  const config = requireConfig(env);
  let backoff = Math.max(1, intervalMs);
  while (!signal?.aborted) {
    try {
      await pollOnce({ targetUrl: config.url, secret: config.secret, fetchImpl });
      if (once) return;
      backoff = Math.max(1, intervalMs);
      await sleep(backoff, signal);
    } catch (error) {
      if (once) throw error;
      await sleep(backoff, signal);
      backoff = Math.min(Math.max(backoff * 2, 1), maxBackoffMs);
    }
  }
}

async function main() {
  const once = process.argv.slice(2).includes("--once");
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await runWorker({ once, signal: controller.signal });
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    // Deliberately exclude the error object: it could include a URL or provider response.
    process.stderr.write(`${error instanceof Error ? error.message : "worker failed"}\n`);
    process.exitCode = 1;
  });
}
