import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { flushSavedSearchAlertDigestForServer } from "@/lib/saved-search/alerts-runtime";

export const runtime = "nodejs";

/* Internal scheduled job (cost-reduction-audit P1.6).
 *
 * In `SAVED_SEARCH_ALERT_MODE=digest` the publish event only ENQUEUES
 * matched (listing, search) pairs; this route is the daily platform-cron
 * driver that groups the backlog per watcher and mails ONE digest per
 * watcher instead of N per-match emails:
 *
 *     curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *          https://<host>/api/internal/scheduled/saved-search-alert-digest/
 *
 * In `per_match` mode (default) the same flush retries rows whose immediate
 * send failed, so the cron is safe to run in either mode.
 *
 * Auth: the same shared `CRON_SECRET` bearer token the other internal
 * scheduled jobs use, compared in constant time. The route FAILS CLOSED —
 * with no secret configured it is 503, not open. */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    // 503 (not 401/403) when unconfigured: there is no secret to fail against.
    const configured = Boolean(process.env.CRON_SECRET);
    return NextResponse.json(
      { ok: false, errors: [configured ? "Invalid cron secret." : "CRON_SECRET is not configured; the scheduled digest flush is disabled."] },
      { status: configured ? 401 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await flushSavedSearchAlertDigestForServer();
  return NextResponse.json(
    {
      ...result,
      at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export function GET() {
  // The flush is a mutation; a GET probe must never trigger it.
  return NextResponse.json({ ok: false, errors: ["Digest flush is POST-only."] }, { status: 405, headers: { "Cache-Control": "no-store" } });
}
