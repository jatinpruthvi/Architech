import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshStaleReraRecordsForServer } from "@/lib/persistence/rera-store";

export const runtime = "nodejs";

/* Internal scheduled job (cost-reduction-audit P1.7).
 *
 * Stale RERA registrations used to be re-checked only when a human hit the
 * admin refresh button — a record could sit STALE indefinitely. This route is
 * the platform-cron driver (e.g. Railway `crons`, daily):
 *
 *     curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *          https://<host>/api/internal/scheduled/rera-refresh/
 *
 * Auth: the same shared `CRON_SECRET` bearer token the other internal
 * scheduled jobs use, compared in constant time. The route FAILS CLOSED —
 * with no secret configured it is 503, not open.
 *
 * The sweep is conservative: it re-verifies STALE records against the
 * configured provider and restores a record ONLY when the authority confirms
 * it; an unconfirmable record stays STALE rather than being downgraded or
 * given a badge it did not earn. */
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
      { ok: false, errors: [configured ? "Invalid cron secret." : "CRON_SECRET is not configured; the scheduled refresh is disabled."] },
      { status: configured ? 401 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await refreshStaleReraRecordsForServer(10);
  return NextResponse.json(
    {
      ...result,
      at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export function GET() {
  // The refresh is a mutation; a GET probe must never trigger it.
  return NextResponse.json({ ok: false, errors: ["Refresh is POST-only."] }, { status: 405, headers: { "Cache-Control": "no-store" } });
}
