import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processWhatsAppOutbox } from "@/lib/whatsapp/worker";

export const runtime = "nodejs";

function secretMatches(candidate: string | null, expected: string | undefined): boolean {
  if (!candidate || !expected) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-architech-worker-secret"), process.env.ARCHITECH_WHATSAPP_WORKER_SECRET)) {
    return NextResponse.json({ ok: false, errors: ["WORKER_AUTH_REQUIRED"] }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const result = await processWhatsAppOutbox({ limit: 25 });
  return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
