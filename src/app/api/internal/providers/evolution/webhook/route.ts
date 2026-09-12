import { NextResponse } from "next/server";
import { EvolutionWebhookError, EVOLUTION_WEBHOOK_MAX_BYTES, applyEvolutionWebhookEvent, verifyEvolutionWebhookRequest } from "@/lib/whatsapp/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > EVOLUTION_WEBHOOK_MAX_BYTES) {
    return new NextResponse(null, { status: 413, headers: { "Cache-Control": "no-store" } });
  }
  let event;
  try {
    event = verifyEvolutionWebhookRequest(rawBody, request.headers.get("authorization"));
  } catch (error) {
    if (error instanceof EvolutionWebhookError && error.kind === "UNSUPPORTED") return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    const status = error instanceof EvolutionWebhookError && error.kind === "AUTH" ? 401 : error instanceof EvolutionWebhookError && error.kind === "TOO_LARGE" ? 413 : 400;
    return NextResponse.json({ ok: false, errors: [error instanceof EvolutionWebhookError ? error.code : "WEBHOOK_INVALID"] }, { status, headers: { "Cache-Control": "no-store" } });
  }
  try {
    await applyEvolutionWebhookEvent(event);
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof EvolutionWebhookError && error.code === "WEBHOOK_INSTANCE_UNKNOWN") {
      return NextResponse.json({ ok: false, errors: [error.code] }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    if (error instanceof EvolutionWebhookError && error.code === "WEBHOOK_MESSAGE_UNKNOWN") {
      return NextResponse.json({ ok: false, errors: [error.code] }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ok: false, errors: ["WEBHOOK_NOT_APPLIED"] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
