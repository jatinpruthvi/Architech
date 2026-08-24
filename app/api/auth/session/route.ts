import { NextResponse } from "next/server";
import { canAccessBrokerDashboard } from "@/lib/auth/roles";
import { getSessionContractForRequest } from "@/lib/auth/live";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const contract = await getSessionContractForRequest(request);
  const status = contract.source === "better-auth-not-configured" ? 503 : 200;

  return NextResponse.json({
    authenticated: Boolean(contract.session),
    session: contract.session,
    canAccessBrokerDashboard: canAccessBrokerDashboard(contract.session),
    authProvider: "better-auth",
    source: contract.source,
    missing: contract.missing,
  }, { status, headers: { "Cache-Control": "no-store" } });
}
