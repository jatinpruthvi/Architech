import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { technoDb } from "@/lib/technoproperty/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.dashboard.read" });
  if (!isAuthorized(access)) return access.response;
  const orgId = access.session.organization?.id;
  const brokerUserId = access.session.user.id;
  if (!orgId) return NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { propertyId?: string; text?: string };
  if (!body.propertyId || typeof body.text !== "string") {
    return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 });
  }
  const text = body.text.slice(0, 1000);
  const db = technoDb();
  const prop = await db.technoProperty.findFirst({ where: { id: body.propertyId, orgId } });
  if (!prop) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (text.trim().length === 0) {
    await db.technoNote.deleteMany({ where: { brokerUserId, orgId, propertyId: body.propertyId } });
    return NextResponse.json({ ok: true, text: "" });
  }
  await db.technoNote.upsert({
    where: { brokerUserId_orgId_propertyId: { brokerUserId, orgId, propertyId: body.propertyId } },
    update: { text, updatedAt: new Date() },
    create: { brokerUserId, orgId, propertyId: body.propertyId, text, updatedAt: new Date() },
  });
  return NextResponse.json({ ok: true, text });
}
