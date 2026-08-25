import { NextResponse } from "next/server";
import { requestReraCorrectionForServer } from "@/lib/persistence/rera-store";
import type { ReraCorrectionInput } from "@/lib/rera/rera";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as ReraCorrectionInput | null;
  if (!body) return NextResponse.json({ ok: false, errors: ["Request body must be JSON."] }, { status: 400 });
  const result = await requestReraCorrectionForServer(body);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result, { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
