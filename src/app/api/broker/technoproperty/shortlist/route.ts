import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { technoDb } from "@/lib/technoproperty/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.dashboard.read" });
  if (!isAuthorized(access)) return access.response;
  const orgId = access.session.organization?.id;
  const brokerUserId = access.session.user.id;
  if (!orgId) return NextResponse.json({ ok: false, error: "ORGANIZATION_REQUIRED" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { propertyId?: string; shortlisted?: boolean };
  if (!body.propertyId) return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400 });
  const want = body.shortlisted !== false;
  const db = technoDb();
  const prop = await db.technoProperty.findFirst({ where: { id: body.propertyId, orgId } });
  if (!prop) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (want) {
    await db.technoShortlist.upsert({
      where: { brokerUserId_orgId_propertyId: { brokerUserId, orgId, propertyId: body.propertyId } },
      update: {},
      create: { brokerUserId, orgId, propertyId: body.propertyId },
    });
  } else {
    await db.technoShortlist.deleteMany({ where: { brokerUserId, orgId, propertyId: body.propertyId } });
  }
  return NextResponse.json({ ok: true, shortlisted: want });
}
