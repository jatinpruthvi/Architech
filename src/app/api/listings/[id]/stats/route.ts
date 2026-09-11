import { NextResponse } from "next/server";
import { getListingStats, recordListingMetric } from "@/lib/analytics/listing-stats";

export const runtime = "nodejs";

const METRICS = new Set(["views", "saves", "inquiries"]);

/** Current tracked stats for a listing. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Next.js decodes dynamic params exactly once — do NOT decodeURIComponent again (BUG-2026-003).
  return NextResponse.json({ ok: true, stats: getListingStats(id) }, { headers: { "Cache-Control": "no-store" } });
}

/** Record a listing metric (view/save/inquiry), idempotent for `sessionKey` on views. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { metric?: string; sessionKey?: string } | null;
  const metric = body?.metric ?? "views";
  if (!METRICS.has(metric)) return NextResponse.json({ ok: false, errors: ["Invalid metric."] }, { status: 400 });
  const result = recordListingMetric(id, metric as "views" | "saves" | "inquiries", body?.sessionKey);
  return NextResponse.json(result, { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
