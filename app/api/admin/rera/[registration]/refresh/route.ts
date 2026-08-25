import { NextResponse } from "next/server";
import { markReraStaleForServer } from "@/lib/persistence/rera-store";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ registration: string }> }) {
  const { registration } = await params;
  const result = await markReraStaleForServer(decodeURIComponent(registration));
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
