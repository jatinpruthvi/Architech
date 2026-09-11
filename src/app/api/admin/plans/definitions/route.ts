import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { isPrismaDataSource } from "@/lib/repositories/source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { createPlanDefinition, type Db } from "@/lib/plans/admin";

export const runtime = "nodejs";

/* Plan definitions (spec §7) — same owner-only, prisma-only guards as the
   main plans route. */
function db(): Db | null {
  if (!isPrismaDataSource()) return null;
  return getPrismaClient() as unknown as Db;
}

function fixtureResponse(): NextResponse {
  return NextResponse.json({ ok: false, error: "NOT_AVAILABLE_IN_FIXTURE_MODE", errors: ["Plan administration needs the database deployment (ARCHITECH_DATA_SOURCE=prisma)."] }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

function ipHash(request: Request): string | undefined {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  return ip ? createHash("sha256").update(ip).digest("hex") : undefined;
}

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "admin.plans.write" });
  if (!isAuthorized(access)) return access.response;
  const database = db();
  if (!database) return fixtureResponse();
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, status: 400, errors: ["A JSON body is required."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ ok: false, status: 400, errors: ["A plan name is required."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const result = await createPlanDefinition(database, { name, ipHash: ipHash(request) });
  if (result.ok) return NextResponse.json({ ok: true, plan: result.plan }, { headers: { "Cache-Control": "no-store" } });
  if (result.error === "CODE_TAKEN") {
    return NextResponse.json({ ok: false, status: 409, errors: ["A plan with that name already exists."] }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: false, status: 400, errors: ["The plan name must be 2–80 characters."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
}
