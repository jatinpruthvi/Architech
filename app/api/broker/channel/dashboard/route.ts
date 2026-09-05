import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { channelDashboardForServer, listChannelDealsForServer, listChannelMatchesForServer, listChannelNotificationsForServer, listChannelRequestsForServer } from "@/lib/persistence/channel-store";
import { listBrokerRequirementsForServer } from "@/lib/requirements.server";

export const runtime = "nodejs";

/**
 * Consolidated broker-channel load (cost-reduction-audit P1.1).
 *
 * The channel page used to fan out SIX `no-store` GETs per load — six
 * serverless invocations, six DB round trips, six serial JSON parses. This
 * one response returns the aggregates AND every panel list. The individual
 * endpoints (requests/matches/deals/notifications/requirements) remain for
 * their mutation routes and the lighter `BrokerChannel` page.
 *
 * Fault tolerance: each panel list degrades to `[]` on its own failure,
 * mirroring the panel's previous per-fetch catch — one broken list must not
 * blank the other five.
 *
 * Caching: `private, max-age=15, stale-while-revalidate=30` — no CDN/shared
 * cache ever sees it (per-session data), but a tab switch within the TTL
 * serves from the browser instead of re-hitting the API. The client must not
 * pass `cache: "no-store"` for this to take effect (see BrokerChannelPanel).
 */

/* The channel-store list functions are typed `ok: boolean` (they union the
   fixture and prisma branches), so the helper stays loose on purpose. */
type ChannelListResult = { ok: boolean; [key: string]: unknown };

async function panelList<T>(run: () => Promise<ChannelListResult>, key: string): Promise<T[]> {
  try {
    const result = await run();
    if (!result.ok) return [];
    const value = result[key];
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.channel.read" });
  if (!isAuthorized(access)) return access.response;
  const result = await channelDashboardForServer(access.session);
  if (result.ok === false) return NextResponse.json(result, { status: (result as { status: number }).status, headers: { "Cache-Control": "no-store" } });

  const [requests, matches, deals, notifications, requirements] = await Promise.all([
    panelList(() => listChannelRequestsForServer(access.session), "requests"),
    panelList(() => listChannelMatchesForServer(access.session), "matches"),
    panelList(() => listChannelDealsForServer(access.session), "deals"),
    panelList(() => listChannelNotificationsForServer(access.session), "notifications"),
    panelList(() => listBrokerRequirementsForServer(access.session), "requirements"),
  ]);

  return NextResponse.json(
    {
      ok: true,
      dashboard: result.dashboard,
      requests,
      matches,
      deals,
      notifications,
      requirements,
    },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } },
  );
}
