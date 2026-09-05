import { NextResponse } from "next/server";
import { enforceMutationSafety } from "@/lib/auth/request-safety";
import { logInfo } from "@/lib/observability/logger";
import { recordWebVitalSample } from "@/lib/observability/metrics-store";
import { isCoreWebVital, metricWithinPhaseOneTarget, type WebVitalPayload } from "@/lib/observability/web-vitals";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const safetyResponse = enforceMutationSafety(request);
  if (safetyResponse) return safetyResponse;
  const body = await request.json().catch(() => null) as WebVitalPayload | null;
  if (!body || !body.name || typeof body.value !== "number") {
    return NextResponse.json({ ok: false, errors: ["Invalid web vital payload."] }, { status: 400 });
  }

  /* Feed the in-process rolling store so /api/observability/slo reports
     measured percentiles instead of assumptions. Recording happens for every
     valid sample; the SLO mapping only consumes LCP/TTFB today. */
  recordWebVitalSample(body.name, body.value);

  const withinTarget = metricWithinPhaseOneTarget(body.name, body.value);
  logInfo({
    event: "web_vital.recorded",
    route: body.route,
    metadata: { ...body, core: isCoreWebVital(body.name), withinTarget },
  });

  return NextResponse.json({ ok: true, core: isCoreWebVital(body.name), withinTarget }, { headers: { "Cache-Control": "no-store" } });
}
