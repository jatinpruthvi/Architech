import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import {
  listMyRequestsForServer,
  listOfferableListings,
  publishDemandForServer,
  publishSupplyForServer,
  runMatcherForServer,
} from "@/lib/channel/server";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

/** The agency's own requests, plus the listings it could offer. */
export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "channel.read" });
  if (!isAuthorized(access)) return access.response;

  const [requests, offerable] = await Promise.all([
    Promise.resolve(listMyRequestsForServer(access.session)),
    listOfferableListings(access.session),
  ]);
  return NextResponse.json({ ok: true, requests, offerable }, { headers: noStore });
}

/** Optional numbers arrive from a form as strings or blanks; a blank means
    "no bound", which is not the same as zero. */
function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "channel.write" });
  if (!isAuthorized(access)) return access.response;

  const body = await request.json().catch(() => ({}));
  const type = String(body.type ?? "").toUpperCase();
  const intent = String(body.intent ?? "BUY").toUpperCase() as "BUY" | "RENT";
  const brokerNote = typeof body.brokerNote === "string" ? body.brokerNote.trim() || null : null;
  const expiryDays = body.expiryDays == null ? undefined : Number(body.expiryDays);

  const result = type === "SUPPLY"
    ? await publishSupplyForServer(
        { intent, listingId: String(body.listingId ?? ""), brokerNote, expiryDays },
        access.session,
      )
    : type === "DEMAND"
      ? publishDemandForServer(
          {
            intent,
            cityId: String(body.cityId ?? ""),
            localityId: body.localityId ? String(body.localityId) : null,
            propertyType: String(body.propertyType ?? ""),
            budgetMinInr: optionalNumber(body.budgetMinInr),
            budgetMaxInr: optionalNumber(body.budgetMaxInr),
            bhkMin: optionalNumber(body.bhkMin),
            bhkMax: optionalNumber(body.bhkMax),
            areaMinSqft: optionalNumber(body.areaMinSqft),
            areaMaxSqft: optionalNumber(body.areaMaxSqft),
            brokerNote,
            expiryDays,
          },
          access.session,
        )
      : { ok: false as const, status: 400, errors: ["Type must be DEMAND or SUPPLY."] };

  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: result.status, headers: noStore });
  }

  /* Match immediately rather than waiting for a scheduler this deployment does
     not have. Idempotent, so publishing repeatedly is safe. */
  const matcher = await runMatcherForServer(access.session);

  return NextResponse.json(
    { ok: true, request: result.data, matcher },
    { status: 201, headers: noStore },
  );
}
