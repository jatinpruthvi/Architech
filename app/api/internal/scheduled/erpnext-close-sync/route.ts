import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processPendingErpnextCloseWritesForCron } from "@/lib/persistence/channel-store";

export const runtime = "nodejs";

/* Internal scheduled job (cost-reduction-audit P1.7).
 *
 * Broker-channel deal closes enqueue an ErpnextCloseWrite row, but nothing
 * flushed those rows except the broker-dashboard "Sync ERPNext closes" button
 * — a human in the loop. This route is the single external driver a platform
 * cron (e.g. Railway `crons`, every few minutes) can hit instead:
 *
 *     curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *          https://<host>/api/internal/scheduled/erpnext-close-sync/
 *
 * Auth: the same shared `CRON_SECRET` bearer token the media-retention sweep
 * uses, compared in constant time. The route FAILS CLOSED — with no secret
 * configured it is 503, not open — so a forgotten env can never expose an
 * unauthenticated admin surface.
 *
 * The per-organization processing claims each write atomically, so this cron
 * and the dashboard button can run at the same time without double-sending a
 * close to ERPNext (idempotency keys guard the ERPNext side as well). */
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
      { ok: false, errors: [configured ? "Invalid cron secret." : "CRON_SECRET is not configured; the scheduled sync is disabled."] },
      { status: configured ? 401 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await processPendingErpnextCloseWritesForCron(10);
  return NextResponse.json(
    {
      ...result,
      at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export function GET() {
  // The sync is a mutation; a GET probe must never trigger it.
  return NextResponse.json({ ok: false, errors: ["Sync is POST-only."] }, { status: 405, headers: { "Cache-Control": "no-store" } });
}
