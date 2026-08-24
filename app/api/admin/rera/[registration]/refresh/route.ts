import { NextResponse } from "next/server";
import { markReraStale } from "@/lib/rera/rera";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ registration: string }> }) {
  const { registration } = await params;
  const result = markReraStale(decodeURIComponent(registration));
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
