import { NextResponse } from "next/server";
import { verifyReraRecord } from "@/lib/rera/rera";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const registration = url.searchParams.get("registration") ?? "";
  const result = verifyReraRecord(registration);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
