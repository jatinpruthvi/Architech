import { NextResponse } from "next/server";
import { authorizeRequest, isAuthorized } from "@/lib/auth/guards";
import { createRequirementForServer, listBrokerRequirementsForServer } from "@/lib/requirements.server";
import type { RequirementInput } from "@/lib/requirements";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.channel.read" });
  if (!isAuthorized(access)) return access.response;
  const result = await listBrokerRequirementsForServer(access.session);
  if (!result.ok) return NextResponse.json(result, { status: result.status, headers: { "Cache-Control": "no-store" } });
  /* Cost-audit P1.1: short private browser TTL (see dashboard route). */
  return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } });
}

export async function POST(request: Request) {
  const access = await authorizeRequest(request, { permission: "broker.channel.write" });
  if (!isAuthorized(access)) return access.response;
  let body: RequirementInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  }
  const result = await createRequirementForServer(body, access.session);
  if (!result.ok) return NextResponse.json(result, { status: result.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
}
