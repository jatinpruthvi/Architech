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
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
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
