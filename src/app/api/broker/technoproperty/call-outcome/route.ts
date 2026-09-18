import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { technoDb } from "@/lib/technoproperty/prisma";
import { TechnoListingType, TechnoRevealChannel } from "@prisma/client";

export const runtime = "nodejs";

const VALID_OUTCOMES = new Set(["connected", "no_answer", "wrong_number", "deal", "follow_up"]);

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.dashboard.read" });
  if (!isAuthorized(access)) return access.response;
  const orgId = access.session.organization?.id;
  const brokerUserId = access.session.user.id;
  if (!orgId) return NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
    propertyId?: string;
    outcome?: string;
    followUpAt?: string | null;
    note?: string | null;
  };
  if (!body.propertyId || !body.outcome || !VALID_OUTCOMES.has(body.outcome)) {
    return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 });
  }
  /* A follow-up without a date would silently never resurface, so the API
     defaults it to tomorrow; a supplied date must actually parse. */
  let followUpAt: Date | null = null;
  if (body.outcome === "follow_up") {
    if (body.followUpAt) {
      followUpAt = new Date(body.followUpAt);
      if (Number.isNaN(followUpAt.getTime())) {
        return NextResponse.json({ ok: false, error: "INVALID_FOLLOW_UP" }, { status: 400 });
      }
    } else {
      followUpAt = new Date(Date.now() + 86_400_000);
    }
  }
  const db = technoDb();
  await db.technoContactEvent.create({
    data: {
      brokerUserId,
      orgId,
      listingType: TechnoListingType.OWNER,
      propertyId: body.propertyId,
      channel: TechnoRevealChannel.CLICK_TO_DIAL,
      outcome: body.outcome,
      followUpAt,
      note: body.note?.slice(0, 500) ?? null,
    },
  });
  if (body.note) {
    await db.technoNote.upsert({
      where: { brokerUserId_orgId_propertyId: { brokerUserId, orgId, propertyId: body.propertyId } },
      update: { text: body.note.slice(0, 1000), updatedAt: new Date() },
      create: { brokerUserId, orgId, propertyId: body.propertyId, text: body.note.slice(0, 1000), updatedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
