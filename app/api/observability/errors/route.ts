import { NextResponse } from "next/server";
import { enforceMutationSafety } from "@/lib/auth/request-safety";
import { logError } from "@/lib/observability/logger";
import { isReportableSeverity, type ClientErrorReport } from "@/lib/observability/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const safetyResponse = enforceMutationSafety(request);
  if (safetyResponse) return safetyResponse;
  const body = (await request.json().catch(() => null)) as Partial<ClientErrorReport> | null;
  if (!body || typeof body.message !== "string" || body.message.trim().length === 0) {
    return NextResponse.json({ ok: false, errors: ["Invalid error report."] }, { status: 400 });
  }

  // Log the normalized report through the redacted pino logger. The logger's
  // redact paths drop phone/email/token fields before they reach the sink.
  logError({
    event: "client_error.reported",
    route: body.route,
    metadata: {
      severity: isReportableSeverity(body.severity) ? body.severity : "error",
      message: body.message,
      componentStack: body.componentStack,
      userAgent: body.userAgent,
      href: body.href,
      buildTag: body.buildTag,
    },
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
