import "server-only";
import { NextResponse } from "next/server";

export const MUTATION_WINDOW_MS = 60_000;
const MAX_MUTATIONS_PER_WINDOW = 60;
const MAX_BODY_BYTES = 256 * 1024;
const buckets = new Map<string, { startedAt: number; count: number }>();

/* BUG-R4-002: hard ceiling on the number of live rate-limit windows.

   `buckets` used to be pruned only by the test helper, so it grew for the
   whole process lifetime: one permanent entry per (client, route, method)
   tuple that ever mutated. The client half of that key comes from
   `x-real-ip` / `cf-connecting-ip` / `x-forwarded-for`, which are attacker-set
   request headers whenever the app is reachable without a proxy that
   overwrites them — so rotating one header minted entries without limit
   (measured: 200k such requests retained ~66 MB of heap that the collector
   could never reclaim). The ring buffer in observability/metrics-store.ts had
   the same defect; both are the same class: unbounded in-process state keyed
   by client input.

   10k simultaneous windows is ~10k distinct clients mutating inside one
   60 s window, far above any realistic load; above that we drop the
   oldest-started windows rather than the process. */
export const MAX_RATE_LIMIT_BUCKETS = 10_000;

/** Number of live rate-limit windows. Exposed for the bound's regression test. */
export function mutationSafetyBucketCount(): number {
  return buckets.size;
}

/* Reclaim window slots. Expired windows are dead weight — the key is
   re-created on the client's next request anyway — so they go first; only if
   the map is still over the ceiling (more clients genuinely active inside one
   window than the cap allows) do we evict the oldest-started windows. Losing a
   window costs a legitimate client at most one unthrottled window, which is
   strictly better than exhausting the process. */
function pruneBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.startedAt >= MUTATION_WINDOW_MS) buckets.delete(key);
  }
  /* Evict down to one BELOW the ceiling: this runs immediately before the
     caller inserts a new window, so the post-insert size is what the ceiling
     actually bounds. */
  const limit = MAX_RATE_LIMIT_BUCKETS - 1;
  if (buckets.size <= limit) return;
  const oldestFirst = [...buckets.keys()].sort(
    (a, b) => (buckets.get(a)?.startedAt ?? 0) - (buckets.get(b)?.startedAt ?? 0),
  );
  const excess = buckets.size - limit;
  for (let index = 0; index < excess; index += 1) buckets.delete(oldestFirst[index]);
}

function error(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: code, errors: [message] }, {
    status,
    headers: { "Cache-Control": "no-store", "Retry-After": "60" },
  });
}

/* Client identity for the per-instance rate limiter.

   The first `x-forwarded-for` value is client-controlled when the app is
   reachable directly: a spoofed header rotates the bucket, and NATed clients
   without any forwarding header all land on the same "unknown" bucket and get
   throttled together. So:

   - When a trusted proxy is in front (`TRUST_PROXY_HEADERS=true`), the proxy
     appends the real client IP, which is the LAST entry of `x-forwarded-for`;
     the head of the header is attacker-controlled.
   - Otherwise we only trust `x-real-ip` / `cf-connecting-ip` (set by proxies
     that overwrite rather than append) and the head of `x-forwarded-for`.
   - With no usable identity we skip rate limiting rather than lumping every
     client into one shared bucket (fail-open; body/origin checks still run).
*/
export function clientKey(request: Request): string | null {
  const direct = request.headers.get("x-real-ip")?.trim() || request.headers.get("cf-connecting-ip")?.trim();
  if (direct) return direct;

  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  if (forwarded.length === 0) return null;
  const trustedProxy = process.env.TRUST_PROXY_HEADERS === "true";
  return (trustedProxy ? forwarded[forwarded.length - 1] : forwarded[0]) || null;
}

/* Sandbox preview proxies (e2b, manus) terminate TLS and forward to
   localhost:3000 WITHOUT an x-forwarded-host header, so the browser sends
   `Origin: https://3000-xxx.e2b.app` while Host is `localhost:3000`. Host
   equality cannot hold, and every mutation 403s -- the requirement form is
   unusable in the one environment where it gets demoed.

   Trusting these two wildcard families OUTSIDE production leaves the guard
   fully intact where it matters: a production build returns false here before
   looking at the origin at all, so the deployed site's CSRF posture is
   unchanged. The same wildcards are already trusted by `frameAncestors` and
   `allowedDevOrigins` in next.config.ts.

   Matched on the parsed hostname, never on a substring: `https://evil.com/?x=.e2b.app`
   and `https://note2b.app.evil.com` both parse to a hostname that fails the
   suffix test, whereas a bare `includes(".e2b.app")` would accept both. */
const PREVIEW_HOST_SUFFIXES = [".e2b.app", ".manus.computer"];

function isTrustedPreviewOrigin(origin: string | null): boolean {
  if (!origin || process.env.NODE_ENV === "production") return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return PREVIEW_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
}

export function enforceMutationSafety(request: Request): NextResponse | null {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return null;

  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return error(413, "PAYLOAD_TOO_LARGE", "Request body exceeds the 256 KB limit.");
  }

  /* Origin guard. A browser mutation must come from a first-party origin:
     either the configured site origin (`NEXT_PUBLIC_SITE_URL`) or the very
     host that served this request. Host equality is the classic CSRF check
     (Django's CsrfViewMiddleware and Next.js Server Actions both compare
     Origin against Host): a cross-site page can make the browser send
     *its* Origin to us, but cannot make it send our Host with a foreign
     Origin, so `Origin === Host` proves the form was served by us. Without
     this arm, every first-party form 403s in local dev and on any preview
     deployment whose public host differs from the configured site URL.
     A missing Origin header (curl, server-to-server) is allowed in
     development, but fails closed in production unless explicitly disabled
     with ALLOW_ORIGINLESS_MUTATIONS=true — otherwise the guard is a no-op
     exactly when it matters. */
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = request.headers.get("origin");

  /* The Origin check runs whether or not a site URL is configured. It used to
     be wrapped in `if (configuredOrigin)`, which meant the CSRF defence
     silently disappeared in every deployment that had not set
     `NEXT_PUBLIC_SITE_URL` — including local dev and any preview using the
     default env. Origin-vs-Host equality needs no configuration to be correct
     (it is exactly what Django and Next.js Server Actions do), so the
     configured origin is now an ADDITIONAL allowed value rather than the
     switch that turns the check on. */
  const allowedOrigins = new Set<string>();
  if (configuredOrigin) {
    try {
      allowedOrigins.add(new URL(configuredOrigin).origin);
    } catch {
      /* An unparseable site URL must not disable the guard. */
    }
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (requestHost) {
    const proto = forwardedProto || (requestHost.startsWith("localhost") || requestHost.startsWith("127.0.0.1") ? "http" : "https");
    allowedOrigins.add(`${proto}://${requestHost}`);
  }

  if (origin) {
    let originValue: string | null = null;
    try {
      originValue = new URL(origin).origin;
    } catch {
      originValue = null;
    }
    /* With no Host header AND no configured origin there is nothing to compare
       against; that is a non-browser caller, handled by the originless branch
       below rather than by rejecting every request. */
    const known = originValue !== null && allowedOrigins.has(originValue);
    if (allowedOrigins.size > 0 && !known && !isTrustedPreviewOrigin(originValue)) {
      return error(403, "ORIGIN_REJECTED", "Request origin is not allowed.");
    }
  } else if (process.env.NODE_ENV === "production" && process.env.ALLOW_ORIGINLESS_MUTATIONS !== "true") {
    return error(403, "ORIGIN_REQUIRED", "A matching Origin header is required for mutations in production.");
  }

  const ip = clientKey(request);
  if (!ip) return null;

  const now = Date.now();
  /* Scoped by route AND client so one user hammering /api/leads cannot flood
     another route's bucket, and one buggy polling client cannot 429 a page. */
  const route = new URL(request.url).pathname;
  const key = `${ip}:${route}:${request.method}`;
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= MUTATION_WINDOW_MS) {
    /* BUG-R4-002: only a brand-new key can grow the map — an expired hit
       overwrites its slot in place. Prune lazily, and only once the map is
       actually at the ceiling, so the steady-state cost stays O(1). */
    if (!current && buckets.size >= MAX_RATE_LIMIT_BUCKETS - 1) pruneBuckets(now);
    buckets.set(key, { startedAt: now, count: 1 });
    return null;
  }
  if (current.count >= MAX_MUTATIONS_PER_WINDOW) return error(429, "RATE_LIMITED", "Too many mutation requests. Please retry shortly.");
  current.count += 1;
  return null;
}

export function clearMutationSafetyBucketsForTests() {
  buckets.clear();
}
