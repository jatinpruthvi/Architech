import { NextResponse } from "next/server";
import { logInfo } from "@/lib/observability/logger";
import { isCoreWebVital, metricWithinPhaseOneTarget, type WebVitalPayload } from "@/lib/observability/web-vitals";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as WebVitalPayload | null;
  if (!body || !body.name || typeof body.value !== "number") {
    return NextResponse.json({ ok: false, errors: ["Invalid web vital payload."] }, { status: 400 });
  }

  const withinTarget = metricWithinPhaseOneTarget(body.name, body.value);
  logInfo({
    event: "web_vital.recorded",
    route: body.route,
    metadata: { ...body, core: isCoreWebVital(body.name), withinTarget },
  });

  return NextResponse.json({ ok: true, core: isCoreWebVital(body.name), withinTarget }, { headers: { "Cache-Control": "no-store" } });
}
