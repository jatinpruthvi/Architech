import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { isPrismaDataSource } from "@/lib/repositories/source";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { isAdminPlanStatus, listPlanAdministration, lookupOrganizationForLogin, applyPlanToOrganization, type Db } from "@/lib/plans/admin";

export const runtime = "nodejs";

/* Owner-only plan administration (spec §7). Prisma mode only: the plan
   ledger is a database surface, and a fixture-mode 503 beats a dead form. */
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

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "admin.plans.read" });
  if (!isAuthorized(access)) return access.response;
  const database = db();
  if (!database) return fixtureResponse();
  const lookupEmail = new URL(request.url).searchParams.get("lookup");
  const base = await listPlanAdministration(database);
  if (!lookupEmail) return NextResponse.json({ ok: true, ...base }, { headers: { "Cache-Control": "no-store" } });
  const lookup = await lookupOrganizationForLogin(database, lookupEmail);
  return NextResponse.json({ ok: true, ...base, lookup: lookup.found ? lookup : { found: false } }, { headers: { "Cache-Control": "no-store" } });
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
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const status = body.status;
  if (!email || !isAdminPlanStatus(status)) {
    return NextResponse.json({ ok: false, status: 400, errors: ["An email login id and a status (TRIAL, ACTIVE or EXPIRED) are required."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  let expiresAt: Date | null = null;
  if (body.expiresAt != null && body.expiresAt !== "") {
    const parsed = new Date(String(body.expiresAt));
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ ok: false, status: 400, errors: ["expiresAt must be a valid date."] }, { status: 400, headers: { "Cache-Control": "no-store" } });
    expiresAt = parsed;
  }
  const result = await applyPlanToOrganization(database, { email, planId: typeof body.planId === "string" ? body.planId : undefined, status, expiresAt, ipHash: ipHash(request) });
  if (!result.ok) {
    // Both ORG_NOT_FOUND and PLAN_NOT_FOUND are 404 (uniform "that thing does
    // not exist" — no oracle between unknown email and unknown plan id).
    return NextResponse.json(result, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true, organization: result.organization, subscription: result.subscription, previousStatus: result.previousStatus }, { headers: { "Cache-Control": "no-store" } });
}
