/* End-to-end harness: boots a REAL production Next.js server and drives it over
 * real HTTP, with a real cookie jar.
 *
 * Why this shape rather than Playwright:
 *
 * - The behaviour that keeps breaking in this codebase is server behaviour —
 *   cookies, redirects, status codes, session revocation, CSRF, role gates.
 *   Those are HTTP facts, and asserting them over HTTP is both the most direct
 *   test and the fastest. The a11y/browser layer already exists separately in
 *   `tests/a11y` and covers rendering and keyboard behaviour.
 * - It runs against `next start` (the production build), so it catches the
 *   whole class of bugs that only appear when built: `trailingSlash` redirects,
 *   route handlers that fail outside dev, Suspense boundaries, prerender errors.
 * - It needs no browser download, so it runs in restricted sandboxes and CI
 *   without a 400MB Chromium fetch.
 *
 * The one thing it deliberately cannot do is assert on rendered client state
 * after hydration. Where a flow depends on that, the test asserts on the
 * server contract the client consumes instead, and says so.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/* ------------------------------------------------------------------ *
 * Assertions
 * ------------------------------------------------------------------ */

export class AssertionError extends Error {}

export function assert(condition, message) {
  if (!condition) throw new AssertionError(message);
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new AssertionError(`${message}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

export function assertMatch(value, pattern, message) {
  if (!pattern.test(String(value))) {
    throw new AssertionError(`${message}\n    pattern: ${pattern}\n    value:   ${JSON.stringify(value)}`);
  }
}

export function assertIncludes(haystack, needle, message) {
  if (!String(haystack).includes(needle)) {
    throw new AssertionError(`${message}\n    missing: ${JSON.stringify(needle)}`);
  }
}

export function assertNotIncludes(haystack, needle, message) {
  if (String(haystack).includes(needle)) {
    throw new AssertionError(`${message}\n    unexpectedly present: ${JSON.stringify(needle)}`);
  }
}

/* ------------------------------------------------------------------ *
 * Cookie jar — a browser-ish client
 * ------------------------------------------------------------------ */

/** Minimal cookie jar: enough to model one browser profile across requests.
 *  Honours Max-Age=0 deletion, which is exactly how sign-out is expressed, so
 *  a test cannot accidentally "stay signed in" because the jar ignored it. */
export class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  applySetCookie(headers) {
    for (const raw of headers) {
      const [pair, ...attrs] = raw.split(";");
      const index = pair.indexOf("=");
      if (index < 0) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      const expired = attrs.some((attr) => /^\s*max-age\s*=\s*0\s*$/i.test(attr));
      if (expired || value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  get(name) {
    return this.cookies.get(name);
  }

  clear() {
    this.cookies.clear();
  }
}

/* ------------------------------------------------------------------ *
 * HTTP client
 * ------------------------------------------------------------------ */

let clientCounter = 0;

/** Create a client. Each one gets a distinct `x-real-ip` so independent test
 *  scenarios do not share the sign-in throttle's per-address budget — they model
 *  different people on different connections, which is what they are. A test
 *  that wants to PROVE throttling pins a fixed `clientIp` instead. */
export function createClient(baseUrl, { clientIp } = {}) {
  const jar = new CookieJar();
  clientCounter += 1;
  const ip = clientIp ?? `203.0.113.${clientCounter % 250}.${clientCounter}`.replace(/\.(\d+)$/, "");

  async function request(method, route, { body, jar: useJar = jar, headers = {}, redirect = "manual", origin = baseUrl } = {}) {
    const requestHeaders = { ...headers };
    /* Mutations carry an Origin because the app's CSRF guard requires one to
       match the serving host. Omitting it here would silently exercise the
       originless path rather than the browser path. */
    if (method !== "GET" && method !== "HEAD") {
      requestHeaders.origin = origin;
      if (body !== undefined && requestHeaders["content-type"] === undefined) {
        requestHeaders["content-type"] = "application/json";
      }
    }
    const cookieHeader = useJar?.header();
    if (cookieHeader) requestHeaders.cookie = cookieHeader;
    /* Stable per-client identity for the rate limiter. Without it every test
       shares one bucket and the suite throttles itself — which looks like a
       product bug and hides real ones. */
    if (requestHeaders["x-real-ip"] === undefined) requestHeaders["x-real-ip"] = ip;

    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      redirect,
    });

    const setCookie = response.headers.getSetCookie();
    if (useJar) useJar.applySetCookie(setCookie);

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    let json;
    if (contentType.includes("application/json")) {
      try {
        json = JSON.parse(text);
      } catch {
        /* Leave `json` undefined; a caller asserting on it will fail loudly. */
      }
    }

    return { status: response.status, headers: response.headers, setCookie, text, json, location: response.headers.get("location") };
  }

  return {
    jar,
    baseUrl,
    clientIp: ip,
    get: (route, options) => request("GET", route, options),
    post: (route, body, options) => request("POST", route, { ...options, body }),
    patch: (route, body, options) => request("PATCH", route, { ...options, body }),
    delete: (route, options) => request("DELETE", route, options),
    /** A second independent browser profile (own cookies, own throttle bucket). */
    fork: (options) => createClient(baseUrl, options),
  };
}

/* ------------------------------------------------------------------ *
 * Server lifecycle
 * ------------------------------------------------------------------ */

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl, child, timeoutMs = 90_000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${baseUrl}${lastError ? `: ${lastError.message}` : ""}`);
}

/** Boot `next start` with the given environment and return a client for it. */
export async function startServer({ env = {}, label = "server", needsAuthUrl = false, singleWorker = false } = {}) {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const nextBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");

  const child = spawn(nextBin, ["start", "-H", "127.0.0.1", "-p", String(port)], {
    /* NOTE: `next start` may fork a pool of workers. Anything a route keeps in
       process memory (the Better Auth memory adapter, the in-process rate
       limiter, the broker draft map) is therefore PER WORKER and will appear to
       flicker across requests. Tests that need a single consistent store must
       pin the worker count — see `singleWorker` below. */
    cwd: root,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_ENV: "production",
      /* The CSRF guard compares Origin against this and the serving host.
         Pinning it to the ephemeral port keeps first-party requests allowed
         while cross-origin ones are still rejected. */
      NEXT_PUBLIC_SITE_URL: baseUrl,
      /* Pin the server to ONE worker when the scenario depends on in-process
         state being shared. This is a test-harness accommodation for a real
         production limitation, not a fix for it: the limitation itself is
         asserted explicitly in the "known limitations" group. */
      ...(singleWorker ? { NEXT_CPUS: "1" } : {}),
      ...env,
      /* Live Better Auth treats BETTER_AUTH_URL as required readiness config
         AND as its trusted origin. The port is only known now, so it is filled
         in here rather than in the caller's static env block. */
      ...(needsAuthUrl ? { BETTER_AUTH_URL: baseUrl } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });

  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  try {
    await waitForServer(baseUrl, child);
  } catch (error) {
    stopServer(child);
    throw new Error(`${label} failed to start: ${error.message}\n${output}`);
  }

  return {
    client: createClient(baseUrl),
    baseUrl,
    child,
    getOutput: () => output,
    stop: () => stopServer(child),
  };
}

export function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") child.kill();
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    /* Already gone. */
  }
}

/* ------------------------------------------------------------------ *
 * Test runner
 * ------------------------------------------------------------------ */

export function createSuite() {
  const results = { passed: 0, failed: 0, failures: [] };
  let currentGroup = "";

  async function group(name, fn) {
    currentGroup = name;
    console.log(`\n\x1b[1m${name}\x1b[0m`);
    await fn();
    currentGroup = "";
  }

  async function test(name, fn) {
    try {
      await fn();
      results.passed += 1;
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } catch (error) {
      results.failed += 1;
      const label = currentGroup ? `${currentGroup} › ${name}` : name;
      results.failures.push({ label, error });
      console.log(`  \x1b[31m✗ ${name}\x1b[0m`);
      console.log(`    ${String(error.message).split("\n").join("\n    ")}`);
    }
  }

  function summary() {
    const total = results.passed + results.failed;
    console.log(`\n${"─".repeat(60)}`);
    if (results.failed === 0) {
      console.log(`\x1b[32m✓ ${results.passed}/${total} end-to-end checks passed\x1b[0m`);
    } else {
      console.log(`\x1b[31m✗ ${results.failed} of ${total} end-to-end checks FAILED\x1b[0m`);
      for (const failure of results.failures) console.log(`  · ${failure.label}`);
    }
    return results.failed === 0;
  }

  return { group, test, summary, results };
}
