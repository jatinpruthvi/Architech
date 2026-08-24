import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/auth/session";
import { canAccessBrokerDashboard } from "@/lib/auth/roles";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "none" ? "none" : "demo";
  const session = getDemoSession(mode);

  return NextResponse.json({
    authenticated: Boolean(session),
    session,
    canAccessBrokerDashboard: canAccessBrokerDashboard(session),
    authProvider: "better-auth",
    source: session?.source ?? "better-auth-contract-demo",
  }, { headers: { "Cache-Control": "no-store" } });
}
