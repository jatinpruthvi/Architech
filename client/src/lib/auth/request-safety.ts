import "server-only";
import { NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_MUTATIONS_PER_WINDOW = 60;
const MAX_BODY_BYTES = 256 * 1024;
const buckets = new Map<string, { startedAt: number; count: number }>();

function error(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: code, errors: [message] }, {
    status,
    headers: { "Cache-Control": "no-store", "Retry-After": "60" },
  });
}

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export function enforceMutationSafety(request: Request): NextResponse | null {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return null;

  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return error(413, "PAYLOAD_TOO_LARGE", "Request body exceeds the 256 KB limit.");
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = request.headers.get("origin");
  if (configuredOrigin && origin && new URL(configuredOrigin).origin !== origin) {
    return error(403, "ORIGIN_REJECTED", "Request origin is not allowed.");
  }

  const now = Date.now();
  const key = `${clientKey(request)}:${request.method}`;
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
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
