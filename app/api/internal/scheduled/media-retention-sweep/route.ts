import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runMediaRetentionSweep } from "@/lib/media/retention-runtime";

export const runtime = "nodejs";

/* Internal scheduled job (cost-reduction-audit P1.2).
 *
 * The media-retention sweep used to run as an in-process timer started from
 * `instrumentation.ts` — reliable on one long-lived Node replica, split-brain
 * on several. This route is the single external driver a platform cron
 * (e.g. Railway `crons`) can hit on a schedule:
 *
 *     curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *          https://<host>/api/internal/scheduled/media-retention-sweep/
 *
 * Auth: a shared `CRON_SECRET` bearer token, compared in constant time. The
 * route FAILS CLOSED — with no secret configured it is 503, not open — so a
 * forgotten env can never expose an unauthenticated admin surface.
 *
 * When the cron drives the sweep, set `MEDIA_RETENTION_SWEEP=off` so the
 * in-process timer does not also run it on every replica (single driver). */
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
      { ok: false, errors: [configured ? "Invalid cron secret." : "CRON_SECRET is not configured; the scheduled sweep is disabled."] },
      { status: configured ? 401 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await runMediaRetentionSweep();
  return NextResponse.json(
    {
      ok: true,
      scanned: result.scanned,
      acted: result.acted,
      actedIds: result.actedIds,
      objectsDeleted: result.objectsDeleted,
      objectDeleteFailures: result.objectDeleteFailures,
      at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export function GET() {
  // The sweep is a mutation; a GET probe must never trigger it.
  return NextResponse.json({ ok: false, errors: ["Sweep is POST-only."] }, { status: 405, headers: { "Cache-Control": "no-store" } });
}
