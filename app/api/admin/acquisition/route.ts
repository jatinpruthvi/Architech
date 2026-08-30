import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { ACQUISITION_READ_PERMISSION, acquisitionHeadline, acquisitionQueue } from "@/lib/seo/acquisition-queue";

export const runtime = "nodejs";

/* The acquisition queue: what to source next, and what it publishes.

   Read-only and behind an existing permission rather than a new one — see
   ACQUISITION_READ_PERMISSION in the module below for the reasoning, and
   docs/seo/seo-os-decisions.md for what to change if that call was wrong.

   Computed per request rather than cached: the whole point is that it moves
   the moment a listing is approved, and a stale worklist is worse than none
   because it sends someone to source inventory the site already has. */
export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: ACQUISITION_READ_PERMISSION });
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
