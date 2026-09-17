import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { decryptContact } from "@/lib/interop/contact-crypto";
import { technoDb } from "@/lib/technoproperty/prisma";
import { TechnoListingType, TechnoRevealChannel } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.dashboard.read" });
  if (!isAuthorized(access)) return access.response;
  const orgId = access.session.organization?.id;
  const brokerUserId = access.session.user.id;
  if (!orgId) {
    return NextResponse.json(
      { ok: false, error: "ORGANIZATION_REQUIRED" },
      { status: 403 },
    );
  }
  const body = (await request.json().catch(() => ({}))) as {
    propertyId?: string;
    brokerListingId?: string;
    listingType?: "owner" | "broker";
    channel?: "click_to_dial" | "whatsapp" | "reveal_only";
  };
  const listingType = body.listingType === "broker" ? TechnoListingType.BROKER : TechnoListingType.OWNER;
  const channel =
    body.channel === "whatsapp"
      ? TechnoRevealChannel.WHATSAPP
      : body.channel === "reveal_only"
        ? TechnoRevealChannel.REVEAL_ONLY
        : TechnoRevealChannel.CLICK_TO_DIAL;

  const db = technoDb();
  if (listingType === TechnoListingType.OWNER && body.propertyId) {
    const prop = await db.technoProperty.findFirst({
      where: { id: body.propertyId, orgId },
    });
    if (!prop) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (!prop.ownerPhoneCipher) {
      return NextResponse.json({ ok: false, error: "PHONE_PENDING" });
    }
    let phone = "";
    try {
      phone = decryptContact(prop.ownerPhoneCipher as Uint8Array);
    } catch {
      return NextResponse.json({ ok: false, error: "DECRYPT_FAILED" }, { status: 500 });
    }
    await db.technoContactEvent.create({
      data: {
        brokerUserId,
        orgId,
        listingType,
        propertyId: prop.id,
        phoneLast4: prop.ownerPhoneLast4,
        channel,
      },
    });
    return NextResponse.json({ ok: true, ownerName: prop.ownerName, phone });
  }
  return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 });
}
