import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { acquisitionHeadline, acquisitionQueue } from "@/lib/seo/acquisition-queue";

export const runtime = "nodejs";

/* The acquisition queue: what to source next, and what it publishes.

   Read-only and behind `moderation.queue.read` rather than a new permission.
   The data is coverage and inventory arithmetic, shown to the same
   operational audience that works the moderation queue, and inventing a
   permission would mean a roles migration for no access-control benefit.

   Computed per request rather than cached: the whole point is that it moves
   the moment a listing is approved, and a stale worklist is worse than none
   because it sends someone to source inventory the site already has. */
export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "moderation.queue.read" });
  if (!isAuthorized(access)) return access.response;

  const plans = acquisitionQueue();
  return NextResponse.json(
    {
      ok: true,
      headline: acquisitionHeadline(),
      plans,
      totals: {
        cities: plans.length,
        withheldIndexes: plans.filter((plan) => !plan.publishable).length,
        listingsToPublishEveryIndex: plans.reduce((sum, plan) => sum + plan.minimumToPublish.gap, 0),
        listingsToFullCoverage: plans.reduce((sum, plan) => sum + plan.fullCoverage.gap, 0),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
