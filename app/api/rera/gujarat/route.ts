import { NextResponse } from "next/server";
import { verifyReraRecordForServer } from "@/lib/rera/server/provider";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const registration = url.searchParams.get("registration") ?? "";
  const result = await verifyReraRecordForServer(registration);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
